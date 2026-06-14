import '@testing-library/jest-dom/vitest';

// jsdom no implementa layout: stub no-op de scrollIntoView para que el buscador
// del presupuesto (auto-scroll de la opción resaltada) y el scroll a la partida
// no revienten en los tests. En el navegador real funciona; aquí basta con que
// no lance. NO se stubea matchMedia: el código lo consume con `?.` y varios
// tests (p.ej. Drawer) dependen de su ausencia para simular reduced-motion.
Element.prototype.scrollIntoView = function scrollIntoView() {};
