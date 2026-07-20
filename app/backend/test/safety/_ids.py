"""Run-unique identifiers for the safety suites.

WHY THIS EXISTS
---------------
Every suite minted its fixture MRNs from

    U = int(time.time() * 1000) % 1000000

which is not a unique token — it is a clock that **wraps every 1,000,000 ms, i.e.
every 16.7 minutes**. Two runs a quarter of an hour apart produce byte-identical
MRNs. `derma_safety_suite.py` was worse still: `PROBE-%05d` from a counter that
restarts at zero, so it reissued `PROBE-00001` on every single run.

None of this failed, because `Patient` had no unique constraint on
`(tenantId, mrn)` — the database accepted every duplicate. That is exactly how
one MRN came to hold five separate charts, which in a clinic means a patient
whose history is split across records nobody knows to join.

Adding the constraint (the real fix) turns those latent collisions into hard
failures, so the fixtures have to become genuinely unique first. This module is
that: one token per process, from a source that does not wrap.

Use `mrn('LAB')` rather than formatting MRNs by hand, so the next suite cannot
reintroduce a wrapping clock.
"""
import os
import time
import uuid

# uuid4 for uniqueness, plus a coarse timestamp and the pid so a stray row is
# still traceable to when and what produced it. Deliberately NOT a modulo of
# anything — the bug this replaces was a truncation.
RUN = '%s%04x' % (uuid.uuid4().hex[:8], os.getpid() & 0xFFFF)

# Monotonic within the process, so callers need no counter of their own.
_seq = [0]


def nid():
    """Next per-run sequence number."""
    _seq[0] += 1
    return _seq[0]


def mrn(prefix):
    """A medical record number unique to this run and this call.

    Kept under 32 characters so it stays readable in a UI and in psql output.
    """
    return '%s-%s-%d' % (prefix, RUN, nid())


def label(word):
    """A display name carrying the run token, so probe rows are attributable."""
    return '%s %s' % (word, RUN)


# Wall-clock stamp for the rare fixture that wants a time-ordered value (e.g. a
# payroll period). Full precision — no modulo.
STAMP = int(time.time())
