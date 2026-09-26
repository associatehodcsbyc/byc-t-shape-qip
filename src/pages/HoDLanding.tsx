import React from 'react';
import { Header } from '../components/Header';
import { SessionBoard } from '../components/hod/SessionBoard';

export const HoDLanding: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SessionBoard />
      </main>
    </div>
  );
};
