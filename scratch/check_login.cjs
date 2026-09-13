const fetch = globalThis.fetch;

(async () => {
  const candidates = [
    'TempAbdiPass2026!',
    'TempAdminPassword2026!',
    'admin1234',
    'Admin1234!',
    'CurrentKnownPass123!'
  ];

  for (const p of candidates) {
    const res = await fetch('http://localhost:5000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'AbdiAdminRetry234@gmail.com',
        password: p
      })
    });
    const data = await res.json();
    console.log(`Testing password "${p}": status = ${res.status}, success = ${data.success}`);
    if (data.success) {
      console.log(`>>> SUCCESSFUL PASSWORD IS: "${p}" <<<`);
      process.exit(0);
    }
  }
})();
