async function checkPagination() {
  const res = await fetch('http://localhost:3000/writers');
  const html = await res.text();
  console.log('Includes pagination nav:', html.includes('aria-label="Writers directory pagination"'));
  console.log('Includes Next button:', html.includes('Next'));
  console.log('Includes page=2:', html.includes('page=2'));
  console.log('Current page 1 marked:', html.includes('aria-current="page">1<'));
}
checkPagination();
