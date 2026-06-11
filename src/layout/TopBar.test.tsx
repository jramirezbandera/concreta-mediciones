import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Breakpoint } from '../hooks/useBreakpoint';
import { TopBar } from './TopBar';

function bpOf(w: number): Breakpoint {
  return {
    w,
    isMobile: w < 760,
    isTablet: w >= 760 && w < 1024,
    isDesktop: w >= 1024,
    isCompact: w < 1024,
  };
}

function bar(w: number) {
  return (
    <TopBar
      view="presupuesto"
      onView={() => {}}
      theme="dark"
      onToggleTheme={() => {}}
      bp={bpOf(w)}
      onMenu={() => {}}
      obraName="Reforma vivienda C/ Mayor 14"
    />
  );
}

describe('TopBar (F8.1 — responsive del chrome)', () => {
  it('en tablet (760–1023) el wordmark cede el sitio a las pestañas (solo logo)', () => {
    render(bar(768));
    expect(screen.queryByText('Concreta')).toBeNull();
    expect(screen.getByRole('button', { name: 'Presupuesto' })).toBeInTheDocument(); // pestañas en el TopBar
  });

  it('en móvil el wordmark vuelve (las pestañas viven en la barra inferior)', () => {
    render(bar(390));
    expect(screen.getByText('Concreta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Presupuesto' })).toBeNull();
  });

  it('en desktop conviven wordmark y pestañas', () => {
    render(bar(1280));
    expect(screen.getByText('Concreta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Presupuesto' })).toBeInTheDocument();
  });
});
