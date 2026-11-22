'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface Props {
  /** La pestaña activa: al cambiar, se vuelve a centrar. */
  activa: string;
  children: ReactNode;
}

/**
 * La `<nav>` de las pestañas, con scroll horizontal en el celular. Si la pestaña
 * activa (`aria-current="page"`) no se ve entera, mueve el scroll de la nav para
 * centrarla, antes de pintar. Mueve `scrollLeft` a mano en vez de usar
 * `scrollIntoView`, que también movería el scroll vertical de la página. Sin JS
 * no hace nada: la pestaña se alcanza con scroll manual.
 */
export function NavPestanas({ activa, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = ref.current;
    const link = nav?.querySelector('[aria-current="page"]');
    if (!nav || !link) return;
    const n = nav.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    // Entera a la vista (escritorio, o una de las primeras): no se toca.
    // Oculta (rutas que Next conserva con display: none), los rects dan 0 y también.
    if (l.left >= n.left && l.right <= n.right) return;
    nav.scrollLeft += l.left - n.left - (n.width - l.width) / 2;
  }, [activa]);

  return (
    <nav ref={ref} aria-label="Estado" className="-mx-1 overflow-x-auto px-1 pb-1">
      {children}
    </nav>
  );
}
