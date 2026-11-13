import json
from pathlib import Path
import tempfile
import unittest
import portal_image_audit as audit


class AuditTests(unittest.TestCase):
    def test_only_image_identity_action_and_time_survive(self):
        event=dict(Type='image',Action='delete',time=1,timeNano=2,
                   Actor=dict(ID='sha256:'+'a'*64,Attributes={'name':'portal:test','SECRET':'do-not-publish'}),secret='hidden')
        self.assertEqual(audit.safe_event(event),dict(action='delete',image='sha256:'+'a'*64,time=1,time_nano=2,name='portal:test'))
        self.assertIsNone(audit.safe_event(dict(event,Type='container')))
        self.assertIsNone(audit.safe_event(dict(event,Action='unknown')))

    def test_rotation_is_bounded_and_keeps_latest_events(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'events.jsonl'
            for index in range(9):audit.append_event(path,{'index':index},maximum=1)
            self.assertEqual(len(list(Path(directory).iterdir())),4)
            self.assertEqual(json.loads(path.read_text()),{'index':8})
            self.assertEqual(json.loads(path.with_name(path.name+'.3').read_text()),{'index':5})

if __name__=='__main__':unittest.main()
