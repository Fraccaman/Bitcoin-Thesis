from multiprocessing import Pool as ThreadPool
import time
import shutil
import os
import zipfile
try:
  import pyfastcopy
except Exception as e:
  pass

folders = []

home = os.path.expanduser("~")

for i in range(0, len(os.walk(home + '/Network/Nodes/').next()[1])):
    folders.append(home + '/Network/Nodes/' + str(os.walk(home + '/Network/Nodes/').next()[1][i]))

def copytree(src, dst, symlinks=False, ignore=None, isRoot = True):
    names = os.listdir(src)
    if ignore is not None:
        ignored_names = ignore(src, names)
    else:
        ignored_names = set()

    if isRoot is not True:
        os.makedirs(dst)

    errors = []
    for name in names:
        if name in ignored_names:
            continue
        srcname = os.path.join(src, name)
        dstname = os.path.join(dst, name)
        try:
            if symlinks and os.path.islink(srcname):
                linkto = os.readlink(srcname)
                os.symlink(linkto, dstname)
            elif os.path.isdir(srcname):
                copytree(srcname, dstname, symlinks, ignore, False)
            else:
                copyfile(srcname, dstname)
        except (IOError, os.error) as why:
            errors.append((srcname, dstname, str(why)))
        # catch the Error from the recursive copytree so that we can
        # continue with other files
        except Exception as err:
            errors.extend(err.args[0])

class CTError(Exception):
    def __init__(self, errors):
        self.errors = errors

try:
    O_BINARY = os.O_BINARY
except:
    O_BINARY = 0
READ_FLAGS = os.O_RDONLY | O_BINARY
WRITE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | O_BINARY
BUFFER_SIZE = 128*1024

def copyfile(src, dst):
    try:
        fin = os.open(src, READ_FLAGS)
        stat = os.fstat(fin)
        fout = os.open(dst, WRITE_FLAGS, stat.st_mode)
        for x in iter(lambda: os.read(fin, BUFFER_SIZE), ""):
            os.write(fout, x)
    finally:
        try: os.close(fin)
        except: pass
        try: os.close(fout)
        except: pass

def copytree2(src, dst, symlinks=False, ignore=[]):
    names = os.listdir(src)

    if not os.path.exists(dst):
        os.makedirs(dst)
    errors = []
    for name in names:
        if name in ignore:
            continue
        srcname = os.path.join(src, name)
        dstname = os.path.join(dst, name)
        try:
            if symlinks and os.path.islink(srcname):
                linkto = os.readlink(srcname)
                os.symlink(linkto, dstname)
            elif os.path.isdir(srcname):
                copytree(srcname, dstname, symlinks, ignore)
            else:
                copyfile(srcname, dstname)
            # XXX What about devices, sockets etc.?
        except (IOError, os.error), why:
            errors.append((srcname, dstname, str(why)))
        except CTError, err:
            errors.extend(err.errors)
    if errors:
        raise CTError(errors)

def removeAndCopy(path):
  print("Starting copy of " + str(path))
  backup = os.path.expanduser("~") + '/../bitcoinbackup/bitcoin/'
  # backup = os.path.expanduser("~") + '/test/0/'
  # backup_zip = os.path.expanduser("~") + '/test/0/Archive.zip'

  for the_file in os.listdir(path):
    file_path = os.path.join(path, the_file)
    try:
        if os.path.isfile(file_path) and os.path.split(file_path)[1] != 'bitcoin.conf':
            os.unlink(file_path)
        elif os.path.isdir(file_path):
          shutil.rmtree(file_path)
    except Exception as e:
        print(e)

  copytree(backup, path)

class Timer():

    @classmethod
    def start(cls):
        cls._start = time.time()

    @classmethod
    def elapsed(cls):
        return time.time() - cls._start

    @classmethod
    def show(cls):
        print("*** Elapsed: %0.5f" % cls.elapsed())

Timer.start()
pool = ThreadPool(20)
results = pool.map(removeAndCopy, folders)
Timer.show()
pool.close()
pool.join()
