"""lib.js + 파트 파일을 합쳐 out/<part>.full.js를 만들고 node로 문법을 검사합니다.
사용: python3 assemble.py c1-theme-icons-base.js [s01-....js ...]"""
import sys, subprocess, pathlib
here = pathlib.Path(__file__).parent
out = here / "out"; out.mkdir(exist_ok=True)
lib = (here / "lib.js").read_text()
for part in sys.argv[1:]:
    pre = lib + ("\n" + (here / "libs.js").read_text() if pathlib.Path(part).name.startswith("s") else "")
    code = pre + "\n// ===== part: " + part + " =====\n" + (here / part).read_text()
    dst = out / (pathlib.Path(part).stem + ".full.js"); dst.write_text(code)
    chk = out / "_check.mjs"; chk.write_text("async function __main(){\n" + code + "\n}\n")
    r = subprocess.run(["node", "--check", str(chk)], capture_output=True, text=True)
    print(dst.name, len(code), "chars", "OK" if r.returncode == 0 else "SYNTAX ERROR\n" + r.stderr[:1500])
    chk.unlink()
