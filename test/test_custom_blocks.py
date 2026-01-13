import pathsim.blocks
from pathsim import Simulation, Connection
from pathsim_chem import Bubbler4


def test_bubbler():
    my_bubbler = Bubbler4()
    source_soluble = pathsim.blocks.Constant(1)
    source_insoluble = pathsim.blocks.Constant(0.5)
    environment = pathsim.blocks.Integrator()
    sco = pathsim.blocks.Scope(
        labels=["Vial 1", "Vial 2", "Vial 3", "Vial 4", "Environment"],
    )

    blocks = [source_soluble, source_insoluble, my_bubbler, environment, sco]

    connections = [
        Connection(source_soluble, my_bubbler[0]),
        Connection(source_insoluble, my_bubbler[1]),
        Connection(my_bubbler[0], sco[0]),
        Connection(my_bubbler[1], sco[1]),
        Connection(my_bubbler[2], sco[2]),
        Connection(my_bubbler[3], sco[3]),
        Connection(my_bubbler[4], environment),
    ]

    sim = Simulation(blocks, connections)
    sim.run(20)
