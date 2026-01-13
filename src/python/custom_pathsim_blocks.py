from pathsim.blocks import ODE, Wrapper
from pathsim_chem import Splitter
import pathsim.blocks
import pathsim.events
import numpy as np


class Process(ODE):
    """
    A block that represents a process with a residence time and a source term.

    Args:
        residence_time: Residence time of the process.
        initial_value: Initial value of the process.
        source_term: Source term of the process.
    """

    _port_map_out = {"inv": 0, "mass_flow_rate": 1}

    def __init__(self, residence_time=0, initial_value=0, source_term=0):
        alpha = -1 / residence_time if residence_time != 0 else 0
        super().__init__(
            func=lambda x, u, t: x * alpha + sum(u) + source_term,
            initial_value=initial_value,
        )
        self.residence_time = residence_time
        self.initial_value = initial_value
        self.source_term = source_term

    def update(self, t):
        x = self.engine.get()
        if self.residence_time == 0:
            mass_rate = 0
        else:
            mass_rate = x / self.residence_time
        # first output is the inv, second is the mass_flow_rate
        outputs = [None, None]
        outputs[self._port_map_out["inv"]] = x
        outputs[self._port_map_out["mass_flow_rate"]] = mass_rate
        # update the outputs
        self.outputs.update_from_array(outputs)


class Splitter2(Splitter):
    _port_map_out = {"source1": 0, "source2": 1}

    def __init__(self, f1=0.5, f2=0.5):
        """
        Splitter with two outputs, fractions are f1 and f2.
        """
        super().__init__(fractions=[f1, f2])


class Splitter3(Splitter):
    _port_map_out = {"source1": 0, "source2": 1, "source3": 2}

    def __init__(self, f1=1 / 3, f2=1 / 3, f3=1 / 3):
        """
        Splitter with three outputs, fractions are f1, f2 and f3.
        """
        super().__init__(fractions=[f1, f2, f3])


class Integrator(pathsim.blocks.Integrator):
    """Integrates the input signal using a numerical integration engine like this:

    .. math::

        y(t) = \\int_0^t u(\\tau) \\ d \\tau
    
    or in differential form like this:

    .. math::
        \\begin{eqnarray}
            \\dot{x}(t) &= u(t) \\\\
                   y(t) &= x(t) 
        \\end{eqnarray}

    The Integrator block is inherently MIMO capable, so `u` and `y` can be vectors.
    
    Example
    -------
    This is how to initialize the integrator: 

    .. code-block:: python
    
        #initial value 0.0
        i1 = Integrator()

        #initial value 2.5
        i2 = Integrator(2.5)
    

    Parameters
    ----------
    initial_value : float, array
        initial value of integrator
    reset_times : list, optional
        List of times at which the integrator is reset.
    """

    def __init__(self, initial_value=0.0, reset_times=None):
        """
        Args:
            initial_value: Initial value of the integrator.
            reset_times: List of times at which the integrator is reset. If None, no reset events are created.
        """
        super().__init__(initial_value=initial_value)
        self.reset_times = reset_times

    def create_reset_events(self) -> list[pathsim.events.ScheduleList]:
        """Create reset events for the integrator based on the reset times.

        Raises:
            ValueError: If reset_times is not valid.

        Returns:
            list of reset events.
        """
        if self.reset_times is None:
            return []
        if isinstance(self.reset_times, (int, float)):
            reset_times = [self.reset_times]
        elif isinstance(self.reset_times, list) and all(
            isinstance(t, (int, float)) for t in self.reset_times
        ):
            reset_times = self.reset_times
        else:
            raise ValueError("reset_times must be a single value or a list of times")

        def func_act(_):
            self.reset()

        event = pathsim.events.ScheduleList(times_evt=reset_times, func_act=func_act)
        return [event]


# FESTIM wall
from pathsim.utils.register import Register


class FestimWall(Wrapper):
    _port_map_out = {"flux_0": 0, "flux_L": 1}
    _port_map_in = {"c_0": 0, "c_L": 1}

    def __init__(
        self,
        thickness,
        temperature,
        D_0,
        E_D,
        T,
        surface_area=1,
        n_vertices=100,
        tau=0,
    ):
        try:
            import festim
        except ImportError:
            raise ImportError("festim is needed for FestimWall node.")

        self.inputs = Register(size=2, mapping=self._port_map_in)
        self.outputs = Register(size=2, mapping=self._port_map_out)

        self.thickness = thickness
        self.temperature = temperature
        self.surface_area = surface_area
        self.D_0 = D_0
        self.E_D = E_D
        self.n_vertices = n_vertices
        self.t = 0.0
        self.stepsize = T

        self.initialise_festim_model()
        super().__init__(T=T, tau=tau, func=self.func)

    def initialise_festim_model(self):
        import festim as F

        model = F.HydrogenTransportProblem()

        model.mesh = F.Mesh1D(
            vertices=np.linspace(0, self.thickness, num=self.n_vertices)
        )
        material = F.Material(D_0=self.D_0, E_D=self.E_D)

        vol = F.VolumeSubdomain1D(id=1, material=material, borders=[0, self.thickness])
        left_surf = F.SurfaceSubdomain1D(id=1, x=0)
        right_surf = F.SurfaceSubdomain1D(id=2, x=self.thickness)

        model.subdomains = [vol, left_surf, right_surf]

        H = F.Species("H")
        model.species = [H]

        model.boundary_conditions = [
            F.FixedConcentrationBC(left_surf, value=0.0, species=H),
            F.FixedConcentrationBC(right_surf, value=0.0, species=H),
        ]

        model.temperature = self.temperature

        model.settings = F.Settings(
            atol=1e-10, rtol=1e-10, transient=True, final_time=1
        )

        model.settings.stepsize = F.Stepsize(initial_value=self.stepsize)

        self.surface_flux_0 = F.SurfaceFlux(field=H, surface=left_surf)
        self.surface_flux_L = F.SurfaceFlux(field=H, surface=right_surf)
        model.exports = [self.surface_flux_0, self.surface_flux_L]

        model.show_progress_bar = False

        model.initialise()

        self.c_0 = model.boundary_conditions[0].value_fenics
        self.c_L = model.boundary_conditions[1].value_fenics

        self.model = model

    def update_festim_model(self, c_0, c_L):
        self.c_0.value = c_0
        self.c_L.value = c_L

        self.model.iterate()

        return self.surface_flux_0.data[-1], self.surface_flux_L.data[-1]

    def func(self, c_0, c_L):
        flux_0, flux_L = self.update_festim_model(c_0=c_0, c_L=c_L)

        flux_0 *= self.surface_area
        flux_L *= self.surface_area

        self.outputs["flux_0"] = flux_0
        self.outputs["flux_L"] = flux_L
        return self.outputs
