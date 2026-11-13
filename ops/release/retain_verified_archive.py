#!/usr/bin/env python3
"""Retain an independently verified exact archive on the build host; never deploy."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tarfile
import tempfile
import portal_release as core


def retain(bundle, verified_image, store):
    core.require(re.fullmatch(r'sha256:[a-f0-9]{64}',verified_image),'Full independently verified image ID required')
    bundle=Path(bundle);store=Path(store)
    data=json.loads((bundle/'manifest.json').read_text())
    core.require(data.get('image')==verified_image and data.get('archive')=='image.tar.gz','Archive is not the exact independently verified image')
    core.require(re.fullmatch(r'[a-f0-9]{40}',data.get('target','')),'Invalid source identity')
    core.version(data['version'])
    source=bundle/'image.tar.gz'
    core.require(core.digest(source)==data['archive_sha256'],'Archive checksum mismatch')
    metadata=core.validate_archive(source,data)
    # Bind both the referenced OCI identity and its actual content, rather than a tag alone.
    digest=verified_image.split(':')[1];bound=False
    with tarfile.open(source,'r|gz') as archive:
        for member in archive:
            if member.name not in ('blobs/sha256/'+digest,metadata.get('Config')): continue
            if member.name.split('/')[-1].removesuffix('.json')!=digest: continue
            core.require(member.isfile() and member.size<=1024**2,'Invalid image identity blob')
            bound=hashlib.sha256(archive.extractfile(member).read()).hexdigest()==digest
            if bound:break
    core.require(bound,'Archive does not contain the verified image identity')
    store.mkdir(parents=True,exist_ok=True,mode=0o700)
    target=store/digest
    core.require(not target.is_symlink(),'Refusing linked archive directory')
    if target.exists():
        existing=json.loads((target/'manifest.json').read_text())
        core.require(existing['image']==verified_image and existing['archive_sha256']==data['archive_sha256']
                     and core.digest(target/'image.tar.gz')==data['archive_sha256'],'Existing archive conflicts; preserved without overwrite')
        return target
    with tempfile.TemporaryDirectory(prefix='.pending-',dir=store) as folder:
        temporary=Path(folder)
        with source.open('rb') as incoming,(temporary/'image.tar.gz').open('xb') as output:
            shutil.copyfileobj(incoming,output,1024*1024);output.flush();os.fsync(output.fileno())
        core.require(core.digest(temporary/'image.tar.gz')==data['archive_sha256'],'Copied archive checksum mismatch')
        for name,value in [('manifest.json',data),('retention.json',dict(image=verified_image,retained_at=datetime.datetime.now(datetime.timezone.utc).isoformat()))]:
            with (temporary/name).open('x') as stream:json.dump(value,stream,indent=2);stream.flush();os.fsync(stream.fileno())
        for path in temporary.iterdir():path.chmod(0o600)
        os.rename(temporary,target)
    return target


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',required=True);parser.add_argument('--verified-image',required=True)
    parser.add_argument('--store',required=True)
    args=parser.parse_args()
    print(retain(args.bundle,args.verified_image,args.store))
