async function testSession() {
  const loginRes = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'http://localhost:3000',
      'Referer': 'http://localhost:3000/login'
    },
    body: 'email=demo-student-1%40example.com&password=DemoPassword123%21',
    redirect: 'manual'
  });
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('Login set-cookie:', cookieHeader ? 'YES' : 'NO');
  if (!cookieHeader) return;
  const cookie = cookieHeader.split(';')[0];
  
  // Check /home
  const homeRes = await fetch('http://localhost:3000/home', {
    headers: { 'Cookie': cookie }
  });
  const homeHtml = await homeRes.text();
  console.log('Home has user-menu-button:', homeHtml.includes('user-menu-button'));
  console.log('Home has Julian Croft:', homeHtml.includes('Julian Croft'));
  console.log('Home has Log in button:', homeHtml.includes('href="/login"'));

  // Check /writers
  const writersRes = await fetch('http://localhost:3000/writers', {
    headers: { 'Cookie': cookie }
  });
  const writersHtml = await writersRes.text();
  console.log('Writers has user-menu-button:', writersHtml.includes('user-menu-button'));
}

testSession();
