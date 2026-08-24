"""
MedCheck backend package marker.

Import convention -- read before adding an import to this package
-----------------------------------------------------------------
Every module inside this package imports its siblings *flat*, e.g.::

    from config import settings
    from services.auth import get_current_user

That works because ``main.py`` inserts this directory onto ``sys.path`` before
importing anything, and because the container sets ``WORKDIR /app`` with this
directory as the application root (``uvicorn main:app``).

Do NOT introduce ``from backend.config import settings`` alongside the flat form.
Python would then load this directory's ``config`` module twice under two
distinct names (``config`` and ``backend.config``), producing two independent
``Settings`` instances. In development each instance generates its own ephemeral
``JWT_SECRET``, so a token signed via one import path would be rejected as
invalid by the other -- an authentication failure that looks random and is
extremely hard to trace back to an import statement.

This file exists so that ``backend`` is an explicit package rather than an
implicit PEP 420 namespace package, which keeps static analysers and packaging
tools consistent with the runtime layout. It must stay side-effect free.
"""
