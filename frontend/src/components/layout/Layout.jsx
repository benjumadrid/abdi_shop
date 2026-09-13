import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AbdiAI from '../chat/AbdiAI';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-500 selection:text-white">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AbdiAI />
    </div>
  );
}
