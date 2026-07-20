"""Self-test for the safety suites' own database helper.

WHY A TEST FOR THE TEST HARNESS
-------------------------------
_db.py is the path by which two dermatology suites set up the state their most
safety-critical assertions depend on (ageing a session so the dose engine sees a
real treatment gap). If it silently misbehaves, those suites do not fail — they
pass while asserting the wrong thing. The harness is therefore load-bearing
safety code, and gets the same treatment as the engine.

It has already failed twice for environment reasons, each time in a branch the
developer's machine did not take:

  - it shelled into a hardcoded container, so anywhere that container was not
    the database under test the setup silently no-opped;
  - it handed a PRISMA connection string to libpq, which rejects Prisma-only
    query parameters outright ('invalid URI query parameter: "schema"'). The
    local rehearsal missed it because with no psql on PATH it took the docker
    branch. Two branches, one verified.

So these checks are deliberately PURE: no database, no psql binary, no docker.
They exercise the branch the developer's machine cannot reach, on the
developer's machine.

Run: python test/safety/db_helper_suite.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _db import _psql_url  # noqa: E402

res = []


def ck(l, c, d=''):
    res.append(bool(c))
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:140]) if d != '' else ''))


print('\n== Prisma-only parameters are removed, because libpq errors on them ==')
# This exact string is what .env and the CI workflow hand to the suites.
PRISMA = 'postgresql://healthos:healthos@localhost:5432/healthos?schema=public'
safe, env = _psql_url(PRISMA)
ck('schema= is not passed to psql', 'schema' not in safe, safe)
ck('the host, port, user and database survive intact',
   safe.startswith('postgresql://healthos:healthos@localhost:5432/healthos'), safe)

# Dropping schema= silently would be its own quiet-wrong-target bug: the SQL
# would run under whatever search_path the role defaults to. It must be
# TRANSLATED, not discarded.
ck('schema= is translated into a search_path, not discarded',
   env is not None and 'search_path=public' in env.get('PGOPTIONS', ''),
   (env or {}).get('PGOPTIONS'))

print('\n== Other Prisma-only parameters are also removed ==')
POOLED = ('postgresql://u:p@h:5432/db?schema=app&connection_limit=5'
          '&pool_timeout=10&pgbouncer=true')
safe2, env2 = _psql_url(POOLED)
for junk in ('connection_limit', 'pool_timeout', 'pgbouncer'):
    ck('%s is stripped' % junk, junk not in safe2, safe2)
ck('and that URL still carries its schema across', 'search_path=app' in (env2 or {}).get('PGOPTIONS', ''),
   (env2 or {}).get('PGOPTIONS'))

print('\n== Real libpq parameters are PRESERVED ==')
# A whitelist that ate sslmode would turn a TLS-required connection into a
# confusing refusal in exactly the environment (managed Postgres) where it matters.
SSL = 'postgresql://u:p@h:5432/db?schema=public&sslmode=require&connect_timeout=9'
safe3, _ = _psql_url(SSL)
ck('sslmode survives', 'sslmode=require' in safe3, safe3)
ck('connect_timeout survives', 'connect_timeout=9' in safe3, safe3)

print('\n== A URL with no query string is left alone ==')
PLAIN = 'postgresql://u:p@h:5432/db'
safe4, env4 = _psql_url(PLAIN)
ck('unchanged', safe4 == PLAIN, safe4)
ck('and no PGOPTIONS is invented', env4 is None, env4)

print('\n== Credentials containing URL-significant characters are not mangled ==')
# A password with an encoded '@' or '/' must survive the round-trip, or the
# helper connects as nobody and every suite that uses it dies obscurely.
ENC = 'postgresql://user:p%40ss%2Fword@localhost:5432/db?schema=public'
safe5, _ = _psql_url(ENC)
ck('percent-encoded password preserved exactly', 'p%40ss%2Fword' in safe5, safe5)

print('\n===== %d/%d passed =====' % (sum(res), len(res)))

if not res:
    print('  NO CHECKS RAN - the suite reached the end without asserting anything')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
