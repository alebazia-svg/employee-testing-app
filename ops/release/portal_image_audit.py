#!/usr/bin/env python3
"""Persist a bounded image event trail; no environment, labels or commands logged."""
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

LOG = Path('/var/log/offonika-release/image-events.jsonl')
MAX_BYTES = 8*1024**2


def safe_event(value):
    if value.get('Type')!='image': return None
    action=value.get('Action') or value.get('status')
    if action not in ('delete','untag','tag','pull','load','import','save'): return None
    image=value.get('Actor',{}).get('ID') or value.get('id','')
    if not re.fullmatch(r'(?:sha256:)?[a-f0-9]{64}',image): return None
    result=dict(action=action,image=image,time=int(value['time']),time_nano=int(value.get('timeNano',0)))
    name=value.get('Actor',{}).get('Attributes',{}).get('name','')
    if re.fullmatch(r'[A-Za-z0-9:._/-]{1,512}',name): result['name']=name
    return result


def append_event(path, value, maximum=MAX_BYTES):
    if path.is_symlink(): raise ValueError('Untrusted image audit symlink')
    if path.exists() and path.stat().st_size>=maximum:
        for index in (3,2,1):
            old=path.with_name(path.name+'.'+str(index))
            if old.exists():
                if index==3: old.unlink()
                else: old.replace(path.with_name(path.name+'.'+str(index+1)))
        path.replace(path.with_name(path.name+'.1'))
    fd=os.open(path,os.O_WRONLY|os.O_APPEND|os.O_CREAT|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'a') as stream:
        info=os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1:
            raise ValueError('Untrusted image audit file')
        stream.write(json.dumps(value)+'\n');stream.flush();os.fsync(stream.fileno())


def main():
    if os.geteuid()!=0: raise ValueError('Image audit service requires root')
    LOG.parent.mkdir(mode=0o700,exist_ok=True)
    for part in (LOG.parent,*LOG.parent.parents):
        info=part.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid!=0 or info.st_mode & 0o022:
            raise ValueError('Untrusted image audit directory')
    process=subprocess.Popen(['docker','--config','/run/offonika-image-audit','events','--since','1h',
        '--filter','type=image','--format','{{json .}}'],stdout=subprocess.PIPE,text=True)
    try:
        for line in process.stdout:
            if len(line)>65536: continue
            try: value=safe_event(json.loads(line))
            except (ValueError,TypeError,KeyError): continue
            if value: append_event(LOG,value)
        raise RuntimeError('Docker image event stream ended: '+str(process.wait()))
    finally:
        process.stdout.close()
        if process.poll() is None: process.terminate();process.wait(timeout=10)


if __name__=='__main__': main()
