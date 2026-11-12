-- =====================================================================
-- Datos iniciales (Seed)
-- 3 escenarios, cada uno con 6 momentos y opciones.
-- =====================================================================

-- Insertar escenarios
INSERT INTO scenarios
    (id, slug, title, description, profile, reflection, status, currency,
     initial_money, initial_time_minutes, initial_energy, initial_wellbeing, sort_order)
VALUES
    (1, 'dia-con-horario-fijo', 'Un día con horario fijo', 'Un empleo con horario, un trayecto largo y poco margen para los imprevistos.', 'Tienes un empleo con horario fijo. Vives lejos del trabajo y el día no deja mucho espacio para improvisar.', 'No hay una forma correcta de vivir este día. Cada decisión cambió algo distinto: unas costaron dinero, otras tiempo, otras energía o ánimo. Lo que muestra el recibo es que llegar al final del día casi nunca cuesta solo lo que cabe en una factura.', 'activo', 'COP', 40000.00, 1080, 75, 65, 1),
    (2, 'dia-estudiando-y-cuidando', 'Estudiar y cuidar', 'Un día repartido entre la clase, la casa y el cuidado de un familiar.', 'Estudias y, además, cuidas a un familiar mayor. Tu día se reparte entre la clase, la casa y la atención a otra persona.', 'Cuidar y estudiar al mismo tiempo reparte el día en más lugares de los que alcanzan las horas. El recibo no mide qué tan bien lo hiciste: solo hace visible lo que normalmente se da por sentado.', 'activo', 'COP', 25000.00, 1080, 70, 60, 2),
    (3, 'dia-sin-empleo-fijo', 'Un día sin empleo fijo', 'Ingresos que dependen de lo que consigas hoy y un lugar para dormir que cambia.', 'No tienes un empleo fijo: tus ingresos dependen de lo que consigas hoy. El lugar donde duermes cambia de una noche a otra.', 'Cuando los ingresos dependen de cada día, hasta las decisiones pequeñas pesan distinto. Este recibo no te califica: muestra lo que cuesta sostener un día sin una red de seguridad debajo.', 'activo', 'COP', 12000.00, 1080, 65, 55, 3)
ON CONFLICT (id) DO NOTHING;

-- Insertar momentos
INSERT INTO moments (id, scenario_id, position, kind, title, narrative, situation)
VALUES
    (101, 1, 1, 'despertar', 'Despertar y prepararse', 'La alarma suena antes de que amanezca. Tienes cuarenta minutos para salir si quieres llegar a tiempo, y en casa todavía hay cosas por resolver.', '¿Cómo usas esos primeros minutos?'),
    (102, 1, 2, 'alimentacion', 'Resolver la alimentación', 'El desayuno casi no tiene hora y en la jornada no habrá mucho espacio para comer. Hay que decidir qué entra al cuerpo hoy.', '¿Cómo resuelves la comida del día?'),
    (103, 1, 3, 'traslado', 'Trasladarse', 'El trabajo queda lejos. Entre ir y volver se puede ir una parte grande del día, y cada forma de hacerlo cuesta distinto en dinero, minutos y cansancio.', '¿Cómo haces el trayecto de ida y vuelta?'),
    (104, 1, 4, 'trabajo_estudio', 'Trabajar', 'La jornada empieza. A media tarde surge una tarea que no estaba prevista y no es claro si puede esperar hasta mañana.', '¿Cómo manejas la jornada?'),
    (105, 1, 5, 'salud_imprevisto', 'Una necesidad de salud', 'Desde hace varios días te molesta la espalda y hoy el dolor se hizo más fuerte. No es una urgencia, pero tampoco se está yendo.', '¿Qué haces con ese dolor?'),
    (106, 1, 6, 'descanso_tareas', 'Descansar o resolver pendientes', 'Llegas a casa. Quedan unas horas y muchas cosas compitiendo por ellas: ropa por lavar, comida para mañana, mensajes sin responder y un cuerpo que pide cama.', '¿A qué le dedicas esas horas?'),
    (201, 2, 1, 'despertar', 'Despertar y prepararse', 'Antes de que la casa despierte ya hay decisiones: quién necesita ayuda primero, qué queda listo y a qué hora tienes que salir.', '¿Cómo organizas la mañana?'),
    (202, 2, 2, 'alimentacion', 'Resolver la alimentación', 'La nevera está casi vacía y el mercado quedó para el fin de semana. Hay que resolver la comida de dos personas con lo que hay.', '¿Cómo resuelves la comida de hoy?'),
    (203, 2, 3, 'traslado', 'Trasladarse', 'La clase de hoy es presencial y la universidad queda al otro lado de la ciudad. En casa, el internet falla seguido.', '¿Cómo llegas a la clase?'),
    (204, 2, 4, 'trabajo_estudio', 'Estudiar', 'Hay clase y, para mañana, un trabajo por entregar. Mientras tanto, la persona a quien cuidas también necesita atención.', '¿Cómo repartes tu energía entre el estudio y el cuidado?'),
    (205, 2, 5, 'salud_imprevisto', 'Una necesidad de salud', 'Al caer la tarde, tu familiar se siente mareado y se acaba un medicamento que toma todos los días.', '¿Cómo atiendes esta necesidad de salud?'),
    (206, 2, 6, 'descanso_tareas', 'Descansar o resolver pendientes', 'Cae la noche. Quedan el trabajo de la universidad, la ropa por lavar y alguien en casa que agradecería compañía.', '¿A qué le dedicas lo que queda del día?'),
    (301, 3, 1, 'despertar', 'Despertar y prepararse', 'Dormiste en una pieza compartida que debes dejar libre antes del mediodía. Todo lo que tienes cabe en dos bolsas y hoy hay que salir a buscar el día.', '¿Cómo te preparas para salir?'),
    (302, 3, 2, 'alimentacion', 'Resolver la alimentación', 'No hay ingreso asegurado hasta que consigas vender o trabajar. Tienes poco dinero y quieres que el día rinda.', '¿Cómo resuelves la comida?'),
    (303, 3, 3, 'traslado', 'Trasladarse', 'El sitio donde mejor se vende o se consigue trabajo queda lejos. Cerca hay otro, donde pasa menos gente.', '¿Cómo llegas a donde vas a trabajar?'),
    (304, 3, 4, 'trabajo_estudio', 'Trabajar', 'Hoy se gana lo que se hace: sin contrato, sin horario y sin nadie que garantice el pago. Cada hora que dedicas es una apuesta.', '¿Cómo repartes tu jornada?'),
    (305, 3, 5, 'salud_imprevisto', 'Una necesidad de salud', 'Hace una semana te duele una muela y hoy no te deja pensar. Además, el cielo se está nublando.', '¿Qué haces con el dolor?'),
    (306, 3, 6, 'descanso_tareas', 'Descansar o resolver pendientes', 'Cae la noche. Hay que decidir dónde dormir y qué hacer con las últimas horas de movimiento en la calle.', '¿Cómo cierras el día?')
ON CONFLICT (id) DO NOTHING;

-- Insertar choices (opciones)
INSERT INTO choices
    (id, moment_id, position, text, money_cost, category, time_change_minutes,
     energy_change, wellbeing_change, consequence, receipt_label, invisible_note)
VALUES
    (1011, 101, 1, 'Levantarme ya y alistarme sin afán, con la casa en orden', 0.00, 'ninguna', -50, -5, 5, 'Sales con todo listo y la sensación de haber empezado el día sin correr. A cambio, tu cuerpo habría querido dormir un rato más.', NULL, 'Sueño recortado para empezar con calma.'),
    (1012, 101, 2, 'Dormir veinte minutos más y arreglarme lo justo', 0.00, 'ninguna', -30, 5, -5, 'Sientes el cuerpo algo más descansado, pero sales casi corriendo y algo se te queda olvidado en casa.', NULL, 'Prisa al salir y algo olvidado en casa.'),
    -- ID 1013 modificado (opción A)
    (1013, 101, 3, 'Revisar que todo esté en orden antes de salir', 0.00, 'ninguna', -20, -3, 5, 'Revisas llaves, documentos y la casa. Sales con tranquilidad, pero con el tiempo justo.', NULL, 'Tiempo para revisar todo.'),

    (1021, 102, 1, 'Cocinar algo completo y llevar el almuerzo en un recipiente', 7000.00, 'alimentacion', -40, 12, 6, 'Desayunas sentado y el almuerzo va contigo en la maleta. Cocinar te quitó tiempo, pero la comida alcanzó para todo el día.', 'Comida preparada y almuerzo para llevar', 'Tiempo de cocina antes de salir.'),
    -- ID 1022 modificado (opción C)
    (1022, 102, 2, 'Comprar una arepa o empanada en la calle', 2500.00, 'alimentacion', -10, 5, 0, 'Comes algo caliente y rápido. El hambre baja, pero el almuerzo sigue siendo una incógnita.', 'Arepa o empanada en la calle', 'Almuerzo sin resolver.'),
    (1023, 102, 3, 'Salir sin comer y ver qué pasa más tarde', 0.00, 'ninguna', 0, -12, -5, 'Ganas unos minutos y conservas el dinero. Hacia media mañana el hambre empieza a pesar en la concentración.', NULL, 'Hambre durante la mañana.'),

    (1031, 103, 1, 'Bus y metro, con dos transbordos', 7200.00, 'transporte', -170, -10, -4, 'Llegas puntual, aunque de pie y entre mucha gente. El regreso se alarga con la hora pico.', 'Pasajes de bus y metro (ida y vuelta)', 'Casi tres horas entre ir y volver.'),
    (1032, 103, 2, 'Pedir un transporte por aplicación', 24000.00, 'transporte', -80, -3, 2, 'El viaje es rápido y cómodo, pero el valor de la tarifa te deja pensando en el resto del día.', 'Transporte por aplicación (ida y vuelta)', NULL),
    (1033, 103, 3, 'Caminar un tramo largo y tomar un solo bus', 3600.00, 'transporte', -180, -16, 0, 'El dinero casi no se toca, pero las piernas sí. Cruzas barrios que no conocías y llegas con el cuerpo cansado.', 'Un pasaje de bus (ida y vuelta)', 'Cansancio acumulado por el camino.'),

    (1041, 104, 1, 'Cumplir el horario y salir a la hora', 0.00, 'ninguna', -480, -20, 0, 'Terminas lo que te correspondía y sales a tu hora. La tarea extra queda anotada para mañana.', NULL, 'Una tarea que quedó para mañana.'),
    (1042, 104, 2, 'Quedarme una hora más para adelantar la tarea', 0.00, 'ninguna', -530, -28, -3, 'Dejas la tarea resuelta y alguien lo nota. Esa hora extra no tiene pago y sales más tarde de lo planeado.', NULL, 'Una hora extra sin pago.'),
    (1043, 104, 3, 'Pedir permiso para salir una hora antes', 8000.00, 'trabajo_estudio', -420, -15, 3, 'Explicas que tienes algo personal que atender y quien coordina acepta, con la hora descontada. Sales con la cabeza más despejada.', 'Hora descontada del pago', NULL),

    (1051, 105, 1, 'Ir al servicio de salud al que estoy afiliado y esperar turno', 4000.00, 'salud', -150, -12, 8, 'La espera es larga, pero sales con una orden médica y la certeza de que alguien lo revisó.', 'Transporte y copago de la consulta', 'Horas de espera en una sala.'),
    (1052, 105, 2, 'Pasar por una farmacia y consultar con quien atiende', 16000.00, 'salud', -25, -3, 2, 'Algo alivia el dolor por hoy. La causa sigue sin saberse, pero al menos podrás dormir mejor.', 'Analgésico y consulta en farmacia', 'Un dolor que sigue sin diagnóstico.'),
    (1053, 105, 3, 'Esperar a ver si se pasa', 0.00, 'ninguna', 0, -10, -8, 'No gastas dinero ni tiempo. El dolor te acompaña toda la noche y vuelve a recordarte que sigue ahí.', NULL, 'Dolor sin atender.'),

    (1061, 106, 1, 'Acostarme temprano y dejar los pendientes para mañana', 0.00, 'ninguna', -30, 25, 10, 'Duermes más y el cuerpo lo agradece. Los pendientes siguen ahí, esperando sin prisa pero sin resolverse.', NULL, 'Pendientes que esperan hasta mañana.'),
    (1062, 106, 2, 'Resolver las tareas de la casa antes de dormir', 6000.00, 'hogar', -120, -12, 2, 'Dejas la casa en orden y mañana será más liviano. Te acuestas tarde y con el cuerpo cansado.', 'Lavandería y compras para mañana', 'Descanso recortado para ponerte al día.'),
    (1063, 106, 3, 'Hacer solo lo más urgente y dormir un poco', 0.00, 'ninguna', -70, 8, 4, 'Resuelves lo que no podía esperar y duermes algo más que ayer. Queda una lista corta para mañana.', NULL, 'Una lista corta de pendientes.'),

    (2011, 201, 1, 'Ayudar con el aseo y las medicinas de mi familiar antes de pensar en mí', 0.00, 'ninguna', -60, -10, 6, 'Tu familiar queda tranquilo y bien atendido. Tú sales con el tiempo ajustado y sin haber desayunado.', NULL, 'Sin tiempo para ti en la mañana.'),
    (2012, 201, 2, 'Dejar el desayuno servido y alistarme rápido', 0.00, 'ninguna', -35, -5, -2, 'Dejas lo esencial resuelto y logras salir a tiempo. Una duda queda dando vueltas: si todo estará bien mientras no estás.', NULL, 'Preocupación por quien se queda en casa.'),
    -- ID 2013 modificado (opción B)
    (2013, 201, 3, 'Revisar la nevera y hacer una lista de lo que falta', 0.00, 'ninguna', -25, -3, 2, 'Sales con la lista clara en la cabeza. Ahorras tiempo en el mercado, pero la mañana se acorta.', NULL, 'Un favor por devolver.'),

    (2021, 202, 1, 'Cocinar con lo que hay en casa', 3000.00, 'alimentacion', -35, 6, 2, 'Sale arroz con huevo y algo de verdura. No es lo que querías, pero alcanza para los dos.', 'Ingredientes para completar la comida', 'Una comida sencilla, con lo que había.'),
    (2022, 202, 2, 'Comprar almuerzo para los dos', 18000.00, 'alimentacion', -15, 10, 6, 'Comen bien y sin apuro, aunque buena parte del dinero del día se va en una sola comida.', 'Almuerzo para dos', NULL),
    -- ID 2023 modificado (opción A)
    (2023, 202, 3, 'Ir a la plaza de mercado y comprar lo más barato', 2500.00, 'alimentacion', -60, 8, 4, 'Compras verduras y algo de proteína. Cocinar toma tiempo, pero la comida alcanza para varios días.', 'Mercado y verduras', 'Tiempo en el mercado y cocina.'),

    (2031, 203, 1, 'Tomar el bus de ida y vuelta', 7200.00, 'transporte', -150, -8, -2, 'Llegas a la clase y logras conversar con tus compañeros. El regreso se hace largo y el dinero se nota.', 'Pasajes de bus (ida y vuelta)', 'Horas de viaje entre ir y volver.'),
    (2032, 203, 2, 'Caminar un tramo y tomar un solo bus', 3600.00, 'transporte', -190, -14, 1, 'Gastas menos, pero cada tramo caminado suma cansancio. Llegas con las piernas pesadas.', 'Un pasaje de bus (ida y vuelta)', 'Cansancio acumulado en el camino.'),
    (2033, 203, 3, 'Conectarme a la clase por internet desde casa', 3000.00, 'trabajo_estudio', -30, -4, -6, 'Te ahorras el viaje y estás cerca de tu familiar. La conexión se corta por momentos y extrañas las conversaciones de pasillo.', 'Recarga de datos para la clase', 'Una clase sin compañía y con la conexión cortándose.'),

    (2041, 204, 1, 'Quedarme en la biblioteca hasta terminar el trabajo', 4000.00, 'trabajo_estudio', -300, -22, 2, 'Entregas el trabajo completo y eso te deja tranquilo. Mientras tanto, otra persona tuvo que cubrirte en casa.', 'Impresiones y copias', 'Horas lejos de casa mientras alguien más cubría.'),
    (2042, 204, 2, 'Entregar lo que alcance a avanzar y volver pronto', 0.00, 'ninguna', -210, -14, -5, 'Entregas una versión corta, con la cabeza dividida entre el papel y la casa. Llegas a tiempo para acompañar a tu familiar.', NULL, 'Un trabajo entregado a medias.'),
    (2043, 204, 3, 'Escribirle a quien dicta la clase para explicar mi situación y pedir más plazo', 0.00, 'ninguna', -170, -10, 2, 'Te responden que pueden darte hasta el viernes. Es un alivio, aunque el trabajo sigue pendiente en tu cabeza.', NULL, 'Un trabajo que sigue pendiente.'),

    -- ID 2051 modificado (opción B)
    (2051, 205, 1, 'Llamar a un médico de confianza y pedir orientación', 0.00, 'salud', -40, -5, 5, 'El médico te da indicaciones por teléfono. No hay medicamento, pero sabes qué hacer hasta mañana.', 'Orientación médica por teléfono', 'Una llamada que tranquiliza.'),
    (2052, 205, 2, 'Comprarlo en una farmacia cercana', 16000.00, 'salud', -30, -3, 3, 'Lo consigues enseguida. Tu familiar toma su dosis a tiempo y tú respiras, aunque el dinero se siente.', 'Medicamento comprado en farmacia', NULL),
    (2053, 205, 3, 'Llamar a la línea de atención del servicio de salud', 0.00, 'ninguna', -60, -5, 0, 'Después de varios intentos alguien te orienta y te dice que el medicamento llegará mañana. Habrá que ingeniárselas esta noche.', NULL, 'Una noche con la medicina pendiente.'),

    (2061, 206, 1, 'Acostarme temprano', 0.00, 'ninguna', -30, 22, 8, 'Duermes más de lo que has dormido en días. El trabajo y la ropa esperan a que despiertes.', NULL, 'Pendientes que esperan.'),
    (2062, 206, 2, 'Avanzar con el estudio y ordenar la casa', 0.00, 'ninguna', -130, -14, 1, 'Dejas el día más liviano para mañana, a costa de dormir poco.', NULL, 'Sueño recortado para ponerte al día.'),
    -- ID 2063 modificado (opción B)
    (2063, 206, 3, 'Ver una serie o leer un rato para desconectar', 0.00, 'ninguna', -60, 8, 6, 'Te desconectas un rato. El cuerpo descansa, pero los pendientes siguen ahí.', NULL, 'Pendientes que esperan.'),

    -- ID 3011 modificado (opción C)
    (3011, 301, 1, 'Asearme en el lugar donde dormí', 0.00, 'ninguna', -30, 2, 2, 'Te arreglas con lo que hay. Sales con la sensación de que no es suficiente, pero el dinero se queda contigo.', NULL, 'Aseo improvisado.'),
    -- ID 3012 modificado (opción B)
    (3012, 301, 2, 'Revisar que no se me haya quedado nada', 0.00, 'ninguna', -20, 2, 2, 'Revisas tus cosas y sales con la tranquilidad de tener todo. El tiempo se acorta, pero no hay sorpresas.', NULL, 'Revisión rápida de pertenencias.'),
    -- ID 3013 modificado (opción C)
    (3013, 301, 3, 'Aceptar que hoy toca dormir donde se pueda', 0.00, 'ninguna', -10, -5, -4, 'Sales sin saber dónde dormirás. La incertidumbre pesa, pero el día sigue y hay que buscar el sustento.', NULL, 'Incertidumbre sobre el lugar para dormir.'),

    (3021, 302, 1, 'Comer un almuerzo completo en un restaurante popular', 9000.00, 'alimentacion', -40, 12, 5, 'Comes caliente y sentado, algo que no pasaba hace días. Una parte importante de lo que tenías se va en ese plato.', 'Almuerzo completo', NULL),
    (3022, 302, 2, 'Comprar pan y un tinto', 3000.00, 'alimentacion', -10, 4, 0, 'Calma el hambre lo justo. Te queda dinero para lo que venga.', 'Pan y tinto', 'Hambre que vuelve temprano.'),
    (3023, 302, 3, 'Ir a un comedor solidario', 0.00, 'ninguna', -70, 9, 4, 'Esperas turno en la fila junto a otras personas. Te sirven comida caliente y, de paso, te enteras de dónde hay trabajo hoy.', NULL, 'Tiempo en la fila.'),

    (3031, 303, 1, 'Pagar el bus hasta el sitio más concurrido', 6000.00, 'transporte', -90, -6, -1, 'Llegas a donde hay más movimiento. El pasaje pesa en el bolsillo, pero estás donde pueden aparecer más oportunidades.', 'Pasajes de bus (ida y vuelta)', NULL),
    (3032, 303, 2, 'Caminar hasta allá', 0.00, 'ninguna', -130, -20, 0, 'Ahorras el pasaje y gastas las piernas. Llegas con calor, cansado y con menos tiempo del que pensabas.', NULL, 'Horas de caminata.'),
    (3033, 303, 3, 'Quedarme en el sector cercano', 0.00, 'ninguna', -30, -3, 0, 'Ahorras tiempo y pasajes, aunque aquí la gente pasa más despacio y las oportunidades se hacen esperar.', NULL, NULL),

    (3041, 304, 1, 'Trabajar una jornada larga, de sol a sol', -45000.00, 'ingreso', -540, -28, -2, 'Cierras el día con más dinero del que esperabas. El cuerpo, en cambio, queda agotado y sin ganas de nada más.', 'Ingresos de la jornada larga', 'Un día entero entregado al trabajo.'),
    (3042, 304, 2, 'Trabajar media jornada y guardar fuerzas', -24000.00, 'ingreso', -300, -14, 2, 'Ganas menos, pero te sobra aire para el resto del día. Queda la duda de si alcanzará.', 'Ingresos de media jornada', 'Una jornada más corta y un ingreso menor.'),
    (3043, 304, 3, 'Aceptar un encargo por unas horas en una casa', -32000.00, 'ingreso', -420, -22, 1, 'Te pagan lo acordado y con buen trato. Fue un trabajo pesado, pero con un pago seguro.', 'Pago por el encargo', 'Horas de trabajo pesado.'),

    (3051, 305, 1, 'Ir al centro de salud más cercano', 2000.00, 'salud', -150, -12, 8, 'La espera es larga, pero te atienden y te dan indicaciones. El dolor empieza a ceder.', 'Transporte al centro de salud', 'Horas de espera en una sala.'),
    (3052, 305, 2, 'Comprar un analgésico en la farmacia', 9000.00, 'salud', -25, -3, 2, 'El dolor baja por un rato. La muela sigue ahí, esperando mejor momento.', 'Analgésico', 'Una muela que sigue sin atenderse.'),
    (3053, 305, 3, 'Aguantar y seguir trabajando', 0.00, 'ninguna', 0, -8, -6, 'Sigues con lo tuyo y el dolor va y viene. Al final del día pesa más.', NULL, 'Dolor sin atender.'),

    (3061, 306, 1, 'Pagar una noche en un hotel', 15000.00, 'hogar', -30, 25, 10, 'Tienes cama, puerta y silencio. Una noche tranquila que se siente como un lujo.', 'Noche en un hotel', NULL),
    (3062, 306, 2, 'Pedir cama prestada a una persona conocida', 0.00, 'ninguna', -60, 15, 3, 'Te reciben con un plato de sopa y una cobija. Te acuestas agradecido, sabiendo que la cama depende de un favor.', NULL, 'Una cama que depende de un favor.'),
    (3063, 306, 3, 'Seguir trabajando un rato más en la noche', -8000.00, 'ingreso', -120, -15, -5, 'Ganas algo más, aunque todavía no sabes dónde vas a dormir. La noche se alarga entre el cansancio y las luces de la calle.', 'Ingresos de la noche', 'Sueño aplazado para ganar un poco más.')
ON CONFLICT (id) DO NOTHING;

-- Ajustar secuencias (ya que insertamos IDs manualmente)
SELECT setval(pg_get_serial_sequence('scenarios', 'id'), (SELECT max(id) FROM scenarios));
SELECT setval(pg_get_serial_sequence('moments', 'id'),   (SELECT max(id) FROM moments));
SELECT setval(pg_get_serial_sequence('choices', 'id'),   (SELECT max(id) FROM choices));