"""Compare two private calendar snapshots. Print counts, never business rows."""
import json
import sys
from pathlib import Path

def read_snapshot(filename):
    snapshot = json.loads(Path(filename).read_text())
    for group in ('plans', 'files'):
        entries = snapshot[group]
        if len(entries) != len(dict(entries)):
            raise ValueError('Duplicate snapshot identity')
    return snapshot

def main():
    before, after = map(read_snapshot, sys.argv[1:])
    same = True
    for group in ('plans', 'files'):
        old, new = dict(before[group]), dict(after[group])
        missing = len(old.keys() - new.keys())
        changed = sum(old[key] != new[key] for key in old.keys() & new.keys())
        print(f'{group}: before={len(old)} after={len(new)} missing={missing} changed={changed} added={len(new.keys() - old.keys())}')
        same &= missing == changed == 0
    if not same or after['luxo'] != before['luxo'] or after['luxo']['state'] != 'PAID_BY_ONE_C':
        raise SystemExit('Review differences before registering the release')
    print(f"Luxo paid; verified physical files: {after['physical']}")

if __name__ == '__main__':
    main()
