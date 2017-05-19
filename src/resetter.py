import urllib2
from multiprocessing.dummy import Pool as ThreadPool
import time
import shutil
import os

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
                _copyfileobj_patched(srcname, dstname)
        except (IOError, os.error) as why:
            errors.append((srcname, dstname, str(why)))
        # catch the Error from the recursive copytree so that we can
        # continue with other files
        except Exception as err:
            errors.extend(err.args[0])

def removeAndCopy(path):
  backup = os.path.expanduser("~") + '/test/0/'

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

def _copyfileobj_patched(fsrc, fdst, length=32*1024*1024):
    """Patches shutil method to hugely improve copy speed"""
    while 1:
        buf = fsrc.read(length)
        if not buf:
            break
        fdst.write(buf)


class Timer():

    @classmethod
    def start(cls):
        cls._start = time.time()

    @classmethod
    def elapsed(cls):
        return time.time() - cls._start

    @classmethod
    def show(cls):
        print "*** Elapsed: %0.5f" % cls.elapsed()

Timer.start()
shutil.copyfileobj = _copyfileobj_patched
pool = ThreadPool(20)
results = pool.map(removeAndCopy, folders)
Timer.show()
pool.close()
pool.join()
