"""Share immutable variable-font instances between measurement and atlas rendering."""
import hashlib,json,os,uuid
from pathlib import Path
from fontTools.varLib.instancer import instantiateVariableFont
try:
 import fcntl
except ImportError:
 fcntl=None

def instance_file(root,path,font,coords):
 cache=Path(root)/'measurement-fonts';cache.mkdir(exist_ok=True)
 key=hashlib.sha256(path.read_bytes()+json.dumps(coords,sort_keys=True).encode()).hexdigest()[:24];file=cache/(key+'.ttf')
 if file.exists():return file
 # On Unix hosts, measurement and atlas processes share one cold build too.
 with (cache/(key+'.lock')).open('a+') as lock:
  if fcntl:fcntl.flock(lock,fcntl.LOCK_EX)
  if file.exists():return file
  instance=instantiateVariableFont(font,coords,inplace=False) if coords else font
  instance.flavor=None
  temporary=cache/(key+'.'+uuid.uuid4().hex+'.tmp')
  try:instance.save(temporary);os.replace(temporary,file)
  finally:
   if temporary.exists():temporary.unlink()
 return file
