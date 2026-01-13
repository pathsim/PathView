import pytest
from pathview.pathsim_utils import make_events


events_data = [
    {
        "name": "my_event",
        "type": "ZeroCrossingDown",
        "func_evt": "def func_evt(t):\n    *_, x = integrator_1()\n    return 10 - x",
        "func_act": "def func_act(t):\n    source_0.off()",
        "tolerance": "1e-8",
        "id": 1754342253698,
    }
]


def test_make_events():
    eval_namespace = {}
    events = make_events(events_data, eval_namespace)
    assert len(events) == 1
    assert events[0].func_evt.__code__.co_argcount == 1
    assert events[0].func_act.__code__.co_argcount == 1
    assert events[0].tolerance == 1e-08
