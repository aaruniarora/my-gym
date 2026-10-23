"""One-time interactive Garmin login; prints the GARMIN_TOKENS secret value."""
import base64
import getpass
import io
import tarfile
import tempfile

from garminconnect import Garmin

path = tempfile.mkdtemp()
client = Garmin(input("Garmin email: "), getpass.getpass("Garmin password: "), prompt_mfa=lambda: input("MFA code: "))
client.login(path)  # no tokens in the empty dir yet, so it logs in with the password and saves tokens there
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz") as tar:
    tar.add(path, arcname=".")
print("Paste this as the GARMIN_TOKENS GitHub secret (keep it private):")
print(base64.b64encode(buf.getvalue()).decode())
