export default function DashboardHome() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Authenticated route is active.</p>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Logout</button>
      </form>
    </main>
  );
}