// =============================================================================
// Catálogo EBSS · Trabajos posteriores (TP1–TP3), apartado 12 del estudio. DATOS.
//
// Transcripción del análisis research/analisis-ejemplos-ebss.md §4.7 con las
// definiciones de la Guía (K-SYS.14): «previsiones» son los elementos de
// seguridad que el proyecto deja, e «informaciones útiles» los datos de la obra
// que importan para mantenerla. Todo queda en poder del promotor para el Libro
// del Edificio. La app solo propone la ficha si el proyecto tiene el elemento.
// =============================================================================

import type { FichaCatalogo } from '../tipos';
import { r } from './comun';

export const TRABAJOS_POSTERIORES: readonly FichaCatalogo[] = [
  {
    id: 'TP1',
    grupo: 'TP',
    titulo: 'Mantenimiento de cubiertas',
    descripcion:
      'Reparación, limpieza y mantenimiento de la cubierta y de los equipos que hay en ella',
    vivienda: true,
    riesgos: [
      r('distinto', 'por el borde y por elementos frágiles'),
      r('mismo', 'en el faldón'),
      r('desprendidos', 'materiales y herramientas'),
      r('desplome', 'hundimiento por acopios'),
      r('termicos', 'reparaciones e impermeabilización'),
      r('golpes', 'reparaciones e impermeabilización'),
      r('electrico'),
    ],
    previsiones: [
      'Acceso a la cubierta previsto desde el proyecto',
      'Resistencia de la cubierta y de sus partes traslúcidas',
      'Zonas de tránsito',
      'Señalización de las zonas frágiles',
      'Anclajes para el arnés y elementos para instalar las protecciones (ganchos de servicio, línea de vida, barandillas), dando prioridad a las colectivas',
    ],
    informaciones: [
      'Equipos que hay en la cubierta (captadores, generación eléctrica, ventilación, climatización)',
      'Carga máxima admisible de la cubierta',
      'Prohibición de acopios excesivos',
      'Acceso desde la escalera o por trampilla',
    ],
    medidas: [
      'Zona inferior aislada y señalizada, también dentro del edificio habitado',
      'Plataformas y pasarelas con barandilla',
      'Arnés amarrado a la línea de vida en los faldones',
      'Andamio o visera con protección en la coronación',
    ],
    protecciones: [],
    epi: ['Arnés anticaídas', 'Calzado antideslizante', 'Guantes'],
    eficacia:
      'El acceso previsto y las barandillas o la línea de vida permanentes eliminan la improvisación en cada trabajo; la señalización de las zonas frágiles reduce la caída por ellas',
    fuentes: ['ss01', 'ss02', 'ss03', 'ss04', 'ss07', 'ss12', 'ss13'],
  },
  {
    id: 'TP2',
    grupo: 'TP',
    titulo: 'Fachadas, ventanas y cristaleras',
    descripcion:
      'Limpieza y reparación de fachadas, ventanas y cristaleras, y mudanzas por fachada',
    vivienda: true,
    riesgos: [r('distinto'), r('desprendidos'), r('desplome', 'hundimiento del andamio')],
    previsiones: [
      'Anclajes para el arnés en la pared o en ménsula para limpiar las ventanas que no se alcanzan desde dentro',
      'Anclajes para poleas de mudanza',
      'Pescantes o pasarelas de limpieza, solo si el edificio los tiene',
    ],
    informaciones: ['Carpinterías practicables o fijas', 'Cómo se limpia cada hueco'],
    medidas: [
      'No improvisar, por corto que sea el trabajo',
      'Andamio o plataforma con barandilla y rodapié, sin huecos y con la carga máxima rotulada',
      'Redes o lonas',
    ],
    protecciones: [],
    epi: ['Arnés con un cable de longitud y resistencia adecuadas'],
    eficacia:
      'Los anclajes previstos eliminan la improvisación del amarre; el andamio con barandilla y las redes reducen la caída del operario y de objetos',
    fuentes: ['ss02', 'ss03', 'ss04', 'ss07', 'ss12'],
  },
  {
    id: 'TP3',
    grupo: 'TP',
    titulo: 'Instalaciones y ascensor',
    descripcion: 'Mantenimiento de las instalaciones del edificio y del ascensor',
    vivienda: true,
    riesgos: [
      r('electrico', 'accionamiento inadvertido, deterioro'),
      r('explosiones', 'combustibles, desechos'),
      r('incendios', 'combustibles, desechos'),
      r('quimicos', 'productos de limpieza o reparación'),
      r('desprendidos', 'al subir equipos'),
      r('atrapamiento', 'órganos móviles'),
      r('distinto', 'foso, techo de cabina, patinillos'),
    ],
    previsiones: [
      'Registros accesibles',
      'Carcasas en los órganos móviles',
      'Acceso protegido al foso, al techo de cabina y a la sala o hueco de máquinas del ascensor',
    ],
    informaciones: [
      'Localización de conducciones, cuadros y llaves de corte',
      'Instrucciones de uso y mantenimiento de los equipos',
      'Mantenimiento por empresa habilitada según cada reglamento (electricidad, instalaciones térmicas, ascensores, protección contra incendios)',
    ],
    medidas: [
      'Zona aislada y señalizada',
      'Instalación fuera de servicio mientras dure el trabajo',
      'En edificio habitado, máquinas desconectadas al acabar la jornada y huecos tapados con elementos resistentes',
    ],
    protecciones: [],
    epi: ['Los del oficio'],
    eficacia:
      'Dejar la instalación fuera de servicio elimina el accionamiento inadvertido; los registros accesibles y las carcasas reducen el atrapamiento y la improvisación',
    fuentes: ['ss01', 'ss07', 'ss12', 'ss13'],
  },
];
