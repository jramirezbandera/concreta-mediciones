// =============================================================================
// Catálogo EBSS · Instalaciones provisionales (IP1–IP9). DATOS.
//
// Transcripción del análisis research/analisis-ejemplos-ebss.md §4.3 con las
// cifras de K-SYS.16: solo las verificadas y las de buena práctica sin
// conflicto; las marcadas ⚠ en el análisis van sin cifra. IP9 es un hueco del
// §4.8 redactado por la app (decisión 11).
// =============================================================================

import type { FichaCatalogo } from '../tipos';
import { r } from './comun';

export const INSTALACIONES_PROVISIONALES: readonly FichaCatalogo[] = [
  {
    id: 'IP1',
    grupo: 'IP',
    titulo: 'Implantación, vallado, accesos y señalización',
    descripcion:
      'Vallado de la obra, accesos de personas y vehículos, casetas, señalización y teléfonos de urgencia',
    vivienda: true,
    riesgos: [
      r('atropellos', 'entrada y salida de camiones; terceros'),
      r('desprendidos', 'sobre terceros'),
      r('mismo', 'piquetas, catas, escombros'),
      r('choque-moviles'),
      r('manipulacion', 'montaje de casetas'),
      r('electrico', 'acometidas'),
    ],
    medidas: [
      'Vallado de toda la obra antes de empezar, de 2,00 m de alto; en vía con tráfico, delimitación por zonas',
      'Accesos separados para personas y vehículos',
      'Carteles «Prohibido el paso a toda persona ajena a la obra» y de uso obligatorio de los EPI; señal de STOP y de salida de camiones',
      'Prohibido estacionar junto al acceso',
      'Señalista en las maniobras de entrada y salida, con su posición en el plano de ordenación',
      'Normas de acceso y circulación colgadas en la entrada y entregadas con recibí',
      'Casetas, aseos y botiquín junto al acceso, en terreno estable y fuera de la zona de trabajo; en edificios de varias plantas pasan a la planta baja al terminar la estructura',
      'En el montaje de las casetas, nadie bajo la carga, guiada con cuerdas y nunca con las manos',
      'Cartel con los teléfonos de urgencia y el centro asistencial, con la distancia y el tiempo',
      'Zonas de paso libres de acopios e iluminadas',
      'Piquetas de replanteo señalizadas; replanteo fuera del radio de acción de las máquinas',
      'Orden y limpieza; retirada frecuente de escombros',
    ],
    protecciones: [
      'Vallado fijo y trasladable',
      'Cerramiento opaco en casco urbano',
      'Malla de balizamiento y cinta bicolor',
      'Marquesina en el acceso peatonal',
      'Señalización de seguridad y de tráfico',
      'Iluminación nocturna',
      'Extintor',
    ],
    epi: [
      'Casco, también para los visitantes',
      'Calzado de seguridad',
      'Ropa de trabajo',
      'Ropa de alta visibilidad para el señalista y en los tajos en calzada',
    ],
    eficacia:
      'El vallado y los accesos separados eliminan la presencia de terceros y el cruce de peatones con vehículos; la señalización y el señalista reducen el riesgo de las maniobras',
    fuentes: ['ss01', 'ss02', 'ss03', 'ss04', 'ss06', 'ss07', 'ss08', 'ss11', 'ss14', 'ss15'],
  },
  {
    id: 'IP2',
    grupo: 'IP',
    titulo: 'Trabajos junto a la vía pública y protección de terceros',
    descripcion:
      'Ocupación de la acera o la calzada, paso peatonal provisional y protección de viandantes y vehículos',
    vivienda: true,
    riesgos: [
      r('atropellos', 'de terceros y del personal'),
      r('desprendidos', 'sobre viandantes'),
      r('distinto', 'zanjas, pozos y arquetas abiertas'),
      r('choque-inmoviles', 'vallas, acopios'),
    ],
    medidas: [
      'Ocupación de la vía pública según la licencia y la ordenanza municipal',
      'Tajos que invadan la calzada señalizados según la Norma 8.3-IC o la ordenanza; aviso a la policía local en los cortes',
      'Si se ocupa la acera, paso peatonal provisional protegido por valla, con señalización nocturna y bordillo nivelado; anchura suficiente (1,20 m como referencia)',
      'Luces rojas cada 10 m y en las esquinas',
      'Peatones separados del tráfico por valla continua; pasarelas a portales y fincas',
      'Zanjas y arquetas en la acera tapadas o con barandilla; chapas de acero en los pasos de vehículos',
      'No acopiar fuera del recinto; en la vía, solo lo que se use antes de la siguiente interrupción',
      'Lonas en los camiones; riego contra el polvo',
      'Salida de vehículos guiada, con un tramo horizontal antes de la calle de 1,5 veces la batalla y 6 m como mínimo',
      'En trabajos de fachada sobre la vía, marquesina o pantalla de recogida que vuele sobre la acera, y zona de caída acotada',
    ],
    protecciones: [
      'Valla peatonal',
      'Vallas de desvío',
      'Conos',
      'Balizas luminosas',
      'Marquesina o pantalla de recogida',
      'Chapas de paso',
    ],
    epi: ['Ropa de alta visibilidad', 'Casco', 'Calzado de seguridad'],
    eficacia:
      'La valla continua y el paso protegido eliminan el contacto de los viandantes con la obra; la marquesina y la señalización reducen la caída de objetos y el riesgo del tráfico',
    fuentes: ['ss01', 'ss03', 'ss07', 'ss08', 'ss11', 'ss15'],
  },
  {
    id: 'IP3',
    grupo: 'IP',
    titulo: 'Servicios afectados y acometidas',
    descripcion:
      'Localización, consignación y protección de las líneas y conducciones existentes, y las acometidas de la obra',
    vivienda: true,
    riesgos: [
      r('electrico', 'líneas aéreas o enterradas'),
      r('explosiones', 'gas'),
      r('incendios', 'gas'),
      r('nocivas', 'gases en el saneamiento'),
      r('desplome', 'rotura de una conducción que inunda la zanja'),
      r('atropellos', 'cortes de calzada'),
    ],
    medidas: [
      'Tabla previa de servicios con «existe / no existe»: líneas aéreas y enterradas, transformadores, gas, agua, saneamiento y telecomunicaciones',
      'Planos de las compañías y sus teléfonos antes de empezar',
      'Dos calicatas como mínimo para confirmar el trazado',
      'Excavación mecánica hasta 0,50 m de la conducción y, desde ahí, a mano',
      'Si la compañía no da garantías, comunicarlo por escrito y no empezar',
      {
        texto:
          'Desvío, corte o consignación por escrito antes del trabajo y descargo por escrito después',
        evitable: 'electrico',
      },
      'Si aparece un servicio no previsto, parar, no tocarlo y avisar a la compañía y a la dirección facultativa',
      'Líneas eléctricas aéreas: distancias de la tabla 1 del anexo I del RD 614/2001; donde no se pueda delimitar la zona con precisión, 3 m hasta 66 kV, 5 m de 110 a 220 kV y 7 m a 380 kV',
      'No llevar a hombro pértigas, reglas ni escaleras bajo las líneas; escaleras aislantes cerca de ellas',
      'Acometidas y aberturas en el vallado señalizadas y aprobadas por el coordinador',
    ],
    protecciones: [
      'Pórticos limitadores de gálibo bajo las líneas',
      'Señalización',
      'Balizamiento',
      'Bombas de achique',
    ],
    epi: [
      'Guantes dieléctricos, debajo de los de cuero',
      'Calzado aislante',
      'Casco con barbuquejo',
      'Gafas',
    ],
    anexoII: [{ apartado: 4, cuando: 'si hay una línea de alta tensión próxima' }],
    eficacia:
      'El corte o la consignación por escrito eliminan el contacto con el servicio; las calicatas, los gálibos y las distancias del RD 614/2001 reducen el riesgo donde el servicio sigue activo',
    fuentes: ['ss01', 'ss07', 'ss08', 'ss09', 'ss11', 'ss15'],
  },
  {
    id: 'IP4',
    grupo: 'IP',
    titulo: 'Instalación eléctrica provisional de obra',
    descripcion:
      'Acometida, cuadros, puesta a tierra, conductores, tomas y alumbrado provisionales de la obra',
    vivienda: true,
    riesgos: [
      r('electrico', 'directos e indirectos'),
      r('incendios'),
      r('termicos'),
      r('mismo', 'mangueras por el suelo'),
    ],
    medidas: [
      'Acometida de la compañía con armario y llave',
      'Cuadro general de intemperie, metálico con la carcasa a tierra o de doble aislamiento, con puerta, cerradura, visera y señal «Peligro, riesgo eléctrico», colgado de un paramento o pie derecho firme y fuera de las rampas; grado de protección IP45 como mínimo en la intemperie (ITC-BT-33, 5.1)',
      'Interruptor general omnipolar accesible desde fuera y magnetotérmicos en todos los circuitos',
      'Toda base o grupo de bases de toma de corriente, de alumbrado o de fuerza, protegida por diferencial de 30 mA como máximo, o alimentada a muy baja tensión de seguridad, o separada por transformador individual (ITC-BT-33, 4.2)',
      'Comprobar a diario que los diferenciales disparan',
      'Maniobras en el cuadro sobre banqueta aislante; extintor de CO₂ junto al cuadro general',
      'Puesta a tierra con pica en arqueta registrable; conductor amarillo-verde solo para tierra, nunca a través de tuberías de agua',
      'Resistencia de la toma de tierra tal que la tensión de contacto no pase de 24 V: RA × Ia ≤ 24 V, con Ia la corriente del diferencial (ITC-BT-33, 4.2 e ITC-BT-24, 4.1.2)',
      'Cables de tensión asignada 450/750 V como mínimo en acometidas y exteriores, con cubierta de policloropreno o similar y aptos para servicios móviles; 300/500 V en interiores (ITC-BT-33, 5.3); sin empalmes con cinta (cajas estancas elevadas o cinta autovulcanizante)',
      'Cables fuera de los pasos de peatones y vehículos; si hay que cruzarlos, con protección especial contra los daños mecánicos (ITC-BT-33, 5.2): tendido aéreo a 2 m como mínimo en zonas de peatones y a 5 m en pasos de vehículos, tensado con fiador, o enterrado a 40–50 cm en tubo de PVC y bajo tablones',
      'Una toma por máquina, con clavija normalizada macho-hembra; prohibido conectar hilos desnudos y desconectar tirando del cable',
      'Circuitos de alumbrado separados; portátiles a 24 V con transformador de seguridad, mango aislante y rejilla; lámparas generales a 2,50 m como mínimo',
      'El trazado eléctrico no coincide con el del agua',
      'Trabajos en la instalación sin tensión, comprobada con detector, y con el cartel «No conectar, personal trabajando»',
      'Montaje y mantenimiento solo por instalador autorizado',
    ],
    protecciones: [
      'Diferenciales y magnetotérmicos',
      'Puesta a tierra de las masas',
      'Doble aislamiento',
      'Cuadros cerrados',
      'Banqueta y alfombrilla aislantes',
      'Señalización',
    ],
    epi: [
      'Guantes y calzado aislantes',
      'Casco dieléctrico',
      'Comprobador de tensión',
      'Herramienta aislada',
    ],
    eficacia:
      'El diferencial de 30 mA con la tierra y el doble aislamiento eliminan el contacto indirecto peligroso; los cuadros cerrados, las clavijas normalizadas y el trabajo sin tensión reducen el directo',
    fuentes: [
      'ss01',
      'ss04',
      'ss05',
      'ss06',
      'ss07',
      'ss08',
      'ss09',
      'ss10',
      'ss11',
      'ss14',
      'ss15',
    ],
  },
  {
    id: 'IP5',
    grupo: 'IP',
    titulo: 'Protección contra incendios de obra',
    descripcion: 'Extintores, evacuación y normas contra el fuego durante la obra',
    vivienda: true,
    riesgos: [r('incendios'), r('explosiones', 'acopio de inflamables, gases licuados')],
    medidas: [
      'Extintores según la clase de fuego, fijos, señalizados y revisados',
      'Extintor de CO₂ (5 a 12 kg) junto al cuadro general y junto al acopio de inflamables',
      'Extintor de polvo polivalente ABC de 6 kg (eficacia 21A-113B) en la oficina, el almacén y los tajos de soplete o soldadura',
      'Caminos de evacuación y escaleras despejados',
      'Inflamables en envases cerrados e identificados; escombro combustible separado',
      'Prohibido fumar donde haya riesgo; sin hogueras; repostar con el motor parado',
      'Ante un incendio eléctrico, cortar primero la tensión; aviso a los bomberos',
      'Personal formado en el uso de los extintores',
    ],
    protecciones: [
      'Extintores',
      'Señalización de extintores, evacuación y prohibido fumar',
      'Agua y arena como medios auxiliares',
    ],
    epi: ['Los del puesto'],
    eficacia:
      'Separar los inflamables y prohibir las llamas elimina la mayor parte de los focos; los extintores y la evacuación despejada reducen las consecuencias',
    fuentes: ['ss01', 'ss02', 'ss03', 'ss04', 'ss07', 'ss08', 'ss10', 'ss11', 'ss15'],
  },
  {
    id: 'IP6',
    grupo: 'IP',
    titulo: 'Servicios higiénicos, vestuario, comedor y primeros auxilios',
    descripcion: 'Aseos, vestuarios, comedor, botiquín y asistencia a los accidentados',
    vivienda: true,
    riesgos: [r('biologicos', 'falta de higiene')],
    medidas: [
      {
        texto:
          'Retretes, lavabos y duchas según el VII Convenio general del sector de la construcción, art. 232.2: un retrete por cada 25 y un lavabo y una ducha por cada 10 trabajadores o fracción que trabajen a la vez en la obra; las duchas, cuando el tipo de actividad o la salubridad lo requieran',
        enTexto: true,
      },
      {
        texto:
          'Vestuario climatizado, con taquilla de doble compartimento, si hay ropa especial o trabajos sucios, y siempre un espacio con llave para cada trabajador (convenio, art. 232.1)',
        enTexto: true,
      },
      'Separación por sexos o uso por separado (convenio, art. 232.3)',
      {
        texto:
          'Instalaciones para comer con calientacomidas, ventilación y calefacción (convenio, art. 233.5); agua potable en los locales y cerca de los puestos (RD 1627/1997, anexo IV A.19)',
        enTexto: true,
      },
      {
        texto:
          'La dotación se adapta al número de trabajadores a la vez, con subcontratas y autónomos (convenio, art. 231.1)',
        enTexto: true,
      },
      {
        texto:
          'Como recomienda la Guía del INSST: vestuario, duchas y lavabos en todas las obras; si se conoce el reparto, un retrete por cada 25 hombres y por cada 15 mujeres, y un urinario por cada 25 hombres',
        enTexto: true,
      },
      'En obra de corta duración o en edificio existente caben soluciones alternativas (convenio, art. 231.4): aseos del local o de la vivienda, cabina compacta conectada a la red, aseo portátil, comedor en zona habilitada o en restaurantes concertados',
      'En servicio antes de empezar la obra; limpieza diaria',
      {
        texto:
          'Primeros auxilios en todo momento por personal con formación suficiente, y medios para evacuar a los accidentados (RD 1627/1997, anexo IV A.14); en todas las obras hay personal con conocimientos en primeros auxilios (convenio, art. 234)',
        enTexto: true,
      },
      {
        texto:
          'Material de primeros auxilios señalizado y de fácil acceso: botiquín portátil con desinfectantes y antisépticos, gasas estériles, algodón, vendas, esparadrapo, apósitos, tijeras, pinzas y guantes desechables, a cargo de una persona designada, revisado y repuesto cuando caduque o se use',
        enTexto: true,
      },
      {
        texto:
          'Con más de 50 trabajadores, local de primeros auxilios con botiquín, camilla y agua potable (convenio, art. 234)',
        enTexto: true,
      },
      'Cartel visible con el centro sanitario más próximo, el recorrido recomendado, la distancia y el tiempo, el 112 y el teléfono de toxicología; los heridos se evacúan en ambulancia',
    ],
    protecciones: [
      'Casetas de aseo y vestuario',
      'Botiquín, también de tajo si hay zonas alejadas',
    ],
    epi: [],
    eficacia:
      'La dotación del convenio y la limpieza diaria eliminan la falta de higiene; el botiquín y la información del centro sanitario reducen las consecuencias de un accidente',
    avisos: [
      'La atención tardía de un accidente no es una forma de accidente: por eso esta ficha lleva un solo riesgo y la asistencia va en las medidas',
    ],
    fuentes: [
      'ss01',
      'ss02',
      'ss03',
      'ss04',
      'ss05',
      'ss06',
      'ss07',
      'ss08',
      'ss09',
      'ss10',
      'ss11',
      'ss12',
      'ss13',
      'ss14',
      'ss15',
    ],
  },
  {
    id: 'IP7',
    grupo: 'IP',
    titulo: 'Acopios y almacenamiento de materiales',
    descripcion: 'Zonas de acopio, apilado de materiales y palés, y su señalización',
    vivienda: true,
    riesgos: [
      r('desplome', 'pilas'),
      r('manipulacion'),
      r('mismo'),
      r('golpes', 'vidrio'),
      r('atrapamiento'),
    ],
    medidas: [
      'Zonas de acopio en el plano de ordenación, según la fase, fuera de los pasos y balizadas',
      'Material suelto de 1,50 m de alto como máximo; sacos en capas cruzadas y, a partir de 1,50 m, en pirámide escalonando 0,50 m',
      'Palés de 700 kg como máximo, flejados y sin apilar cargados; material rodante calzado',
      'Ferralla, perfiles y tablones sobre durmientes, en pilas de 1,50 m como máximo',
      'Vidrio en vertical sobre durmientes, algo ladeado y señalizado',
      'Palés de ladrillo junto a los pilares, lejos de los vanos y de los bordes; no sobrecargar forjados ni cubiertas',
      'Nada en las casetas de higiene',
      'Acopios separados del borde de las excavaciones a la distancia que fije el técnico competente según el terreno (ver F4 y F5)',
    ],
    protecciones: ['Vallas o malla de balizamiento', 'Señalización'],
    epi: ['Guantes', 'Calzado de seguridad', 'Casco'],
    eficacia:
      'Las alturas máximas y el flejado eliminan el desplome de las pilas; el balizamiento y el orden reducen los golpes y las caídas en los pasos',
    fuentes: ['ss01', 'ss03', 'ss07', 'ss09', 'ss11', 'ss14', 'ss15'],
  },
  {
    id: 'IP8',
    grupo: 'IP',
    titulo:
      'Almacén de inflamables y productos químicos (pinturas, colas, disolventes, gases licuados)',
    descripcion:
      'Recinto para los productos inflamables y químicos de la obra y las botellas de gas',
    vivienda: true,
    riesgos: [
      r('incendios'),
      r('explosiones'),
      r('quimicos', 'vapores'),
      r('nocivas', 'trasvases'),
    ],
    medidas: [
      'Recinto ventilado, con corriente de aire, e iluminado, con puerta y cerradura',
      'Extintor junto a la puerta; señales «Peligro de incendio» y «Prohibido fumar»',
      'Envases cerrados y etiquetados, con su ficha de datos de seguridad; productos separados por incompatibilidad',
      'Botellas de gas de pie, sujetas en carro, a la sombra y con capuchón; letrero «No usar acetileno para soldar cobre»',
      'Nunca en las casetas de higiene',
      'Trapos impregnados en un recipiente metálico cerrado, para el gestor',
    ],
    protecciones: ['Ventilación', 'Extintor', 'Señalización'],
    epi: ['Guantes', 'Mascarilla con filtro para vapores en los trasvases'],
    eficacia:
      'El recinto cerrado, ventilado y sin llamas elimina el foco de ignición junto a los productos; la mascarilla y los envases cerrados reducen la exposición a los vapores',
    fuentes: ['ss01', 'ss02', 'ss07', 'ss10', 'ss11', 'ss15'],
  },
  {
    id: 'IP9',
    grupo: 'IP',
    titulo: 'Obra con el edificio habitado o el local en uso',
    descripcion:
      'Organización de la obra cuando el resto del edificio, o el local, sigue en uso durante los trabajos',
    vivienda: true,
    riesgos: [
      r('desprendidos', 'sobre los ocupantes en los pasos comunes'),
      r('mismo', 'escombro y materiales en portal, escalera y descansillos'),
      r('quimicos', 'polvo y vapores que pasan a las viviendas'),
      r('electrico', 'servicios comunes afectados'),
      r('incendios', 'trabajos con llama junto a zonas ocupadas'),
      r('distinto', 'huecos abiertos accesibles a los ocupantes'),
    ],
    medidas: [
      'Zona de obra separada físicamente de la zona en uso: tabiques o cerramientos provisionales de madera o placa, cerrados con llave, y puertas que no den paso a los ocupantes',
      'Horario de los trabajos ruidosos y de las interrupciones de servicios pactado con la comunidad o el usuario y avisado por escrito con antelación',
      'Cortes de agua, luz, gas y telecomunicaciones de las zonas en uso solo avisados con antelación a los ocupantes, en el menor tiempo posible y nunca sin reponer al acabar la jornada',
      'Pasos comunes (portal, escalera, ascensor) libres de escombro y de materiales en todo momento; limpieza al acabar cada jornada',
      'Protección del portal, la escalera y el ascensor con tableros o lonas donde pase material, y acceso de la obra por un recorrido distinto al de los ocupantes siempre que sea posible',
      'Ningún hueco abierto queda accesible a los ocupantes: tapas o barandillas también fuera del horario de obra',
      'Evacuación del escombro en horario y por un recorrido avisados, con bajante cerrada o contenedor en la calle (ver MA10)',
      'Riego y barreras contra el polvo; ventilación de los tajos con disolventes hacia el exterior, nunca hacia las zonas en uso',
      'Trabajos con llama o soldadura lejos de las zonas ocupadas, con extintor en el tajo y vigilancia al terminar',
      'Al terminar la jornada, máquinas desconectadas y herramientas y productos químicos recogidos bajo llave',
      'Si cambia el recorrido de evacuación del edificio, señalizarlo y avisar a los ocupantes',
    ],
    protecciones: [
      'Cerramientos provisionales con llave',
      'Tapas y barandillas en los huecos, también fuera del horario de obra',
      'Tableros y lonas en los pasos comunes',
      'Señalización para los ocupantes',
      'Extintor en el tajo',
    ],
    epi: ['Los de cada tajo'],
    eficacia:
      'La separación física y el acceso independiente eliminan la presencia de los ocupantes en la zona de obra; los avisos, la limpieza diaria y las protecciones fuera de horario reducen el riesgo en lo que se comparte',
    avisos: [
      'Ficha redactada por la app (decisión 11): ningún ejemplo trae una ficha útil para este caso. El proyectista la revisa antes de entregar',
      'Lo que se pacte con los ocupantes va también al apartado 9 del estudio (otras actividades en el lugar)',
    ],
    fuentes: [],
    redactadaPorApp: true,
  },
];
