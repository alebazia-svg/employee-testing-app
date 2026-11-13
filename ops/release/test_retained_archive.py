import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import retain_verified_archive as retain


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.bundle=self.root/'bundle';self.bundle.mkdir();self.store=self.root/'store'
        blob=b'{"immutable":"fixture"}';self.image='sha256:'+hashlib.sha256(blob).hexdigest()
        target='a'*40;path=self.bundle/'image.tar.gz'
        metadata=json.dumps([dict(RepoTags=['offonika-portal-release:1.2.3-'+target[:12]],Config='unused')]).encode()
        with tarfile.open(path,'w:gz') as archive:
            for name,value in [('manifest.json',metadata),('blobs/sha256/'+self.image.split(':')[1],blob)]:
                info=tarfile.TarInfo(name);info.size=len(value);archive.addfile(info,io.BytesIO(value))
        data=dict(image=self.image,archive='image.tar.gz',target=target,version='1.2.3',archive_sha256=retain.core.digest(path))
        (self.bundle/'manifest.json').write_text(json.dumps(data))

    def test_exact_archive_survives_source_removal_and_idempotent_retry(self):
        target=retain.retain(self.bundle,self.image,self.store)
        self.assertEqual(retain.retain(self.bundle,self.image,self.store),target)
        self.assertEqual((target/'image.tar.gz').stat().st_mode & 0o777,0o600)
        (self.bundle/'image.tar.gz').unlink()
        self.assertTrue((target/'image.tar.gz').is_file())

    def test_mismatch_and_corruption_never_overwrite_an_existing_backup(self):
        target=retain.retain(self.bundle,self.image,self.store);original=(target/'image.tar.gz').read_bytes()
        with self.assertRaises(retain.core.ReleaseError):retain.retain(self.bundle,'sha256:'+'f'*64,self.store)
        (self.bundle/'image.tar.gz').write_bytes(b'corrupt')
        with self.assertRaises(retain.core.ReleaseError):retain.retain(self.bundle,self.image,self.store)
        self.assertEqual((target/'image.tar.gz').read_bytes(),original)

if __name__=='__main__':unittest.main()
