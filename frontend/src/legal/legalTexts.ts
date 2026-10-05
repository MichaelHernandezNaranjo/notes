import type { Language } from '../i18n/translations';

/**
 * Version of the Terms & Conditions / Privacy Policy. MUST match `Terms:Version` in the backend
 * (appsettings.json): the server rejects logins that do not carry the current version.
 * Bump it (in both places) whenever the texts change materially so users accept again.
 */
export const TERMS_VERSION = '2026-10-05';
export const CONTACT_EMAIL = 'info@d4nthi.com';

export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = { title: string; updated: string; intro: string; sections: LegalSection[] };
export type LegalKind = 'terms' | 'privacy';

const es: Record<LegalKind, LegalDocument> = {
  terms: {
    title: 'Términos y Condiciones de Uso',
    updated: 'Última actualización: 5 de octubre de 2026',
    intro:
      'Estos Términos y Condiciones regulan el acceso y uso de Notes (la «Aplicación»), un servicio de notas y archivos colaborativos en tiempo real ofrecido por d4nthi («d4nthi», «nosotros»). Al iniciar sesión declaras que los has leído y que los aceptas.',
    sections: [
      {
        heading: '1. Aceptación y capacidad',
        paragraphs: [
          'El uso de la Aplicación implica la aceptación íntegra de estos Términos y de la Política de Privacidad. Si no estás de acuerdo, no debes usarla.',
          'Declaras tener capacidad legal para obligarte conforme a la ley colombiana y, si eres menor de edad, contar con la autorización de tus representantes legales.',
        ],
      },
      {
        heading: '2. El servicio',
        paragraphs: [
          'Notes permite crear, organizar y editar notas y carpetas, adjuntar imágenes, compartirlas con otras personas o grupos con distintos niveles de permiso, restaurar elementos desde la papelera y exportar contenido.',
          'Podemos modificar, suspender o descontinuar funcionalidades para mejorar el servicio o por razones técnicas, procurando avisar cuando el cambio sea relevante.',
        ],
      },
      {
        heading: '3. Cuenta y acceso',
        paragraphs: [
          'El acceso se realiza mediante tu cuenta de Google. Eres responsable de la seguridad de tu cuenta y de toda la actividad realizada desde ella. Debes avisarnos de inmediato si detectas un uso no autorizado.',
        ],
      },
      {
        heading: '4. Contenido del usuario',
        paragraphs: [
          'Conservas la titularidad sobre el contenido que creas o cargas. Nos otorgas una licencia limitada, no exclusiva y gratuita únicamente para almacenarlo, procesarlo y mostrarlo con el fin de prestarte el servicio (incluida la colaboración con las personas con quienes decidas compartirlo).',
          'Eres el único responsable del contenido y de contar con los derechos necesarios para publicarlo. Cuando compartes una nota, quienes reciban acceso podrán verla y, según el permiso otorgado, editarla.',
        ],
      },
      {
        heading: '5. Uso aceptable',
        paragraphs: [
          'Te comprometes a no utilizar la Aplicación para: (a) almacenar o difundir contenido ilegal, difamatorio, que infrinja derechos de terceros o de propiedad intelectual; (b) intentar acceder sin autorización a datos o cuentas ajenas; (c) interferir con el funcionamiento o la seguridad del servicio, incluida la carga de código malicioso; (d) realizar un uso automatizado que degrade el servicio.',
          'Podemos suspender o cancelar el acceso, y retirar contenido, cuando haya incumplimiento de estos Términos o requerimiento de autoridad competente.',
          'La suspensión (bloqueo de la cuenta) la decide un administrador de d4nthi: cierra tus sesiones y te impide iniciar sesión, pero no elimina tus notas. Si crees que se trata de un error, escríbenos a nuestro correo de contacto.',
        ],
      },
      {
        heading: '6. Almacenamiento, papelera y copias de seguridad',
        paragraphs: [
          'Cada cuenta dispone de un límite de almacenamiento (por defecto 250 MB), que cuenta el texto de tus notas y sus imágenes, incluido lo que está en la papelera. Puedes consultar tu uso en Configuración. Los administradores pueden aumentar o reducir el límite de una cuenta.',
          'Al alcanzar el límite podrás leer y eliminar contenido, pero no añadir contenido nuevo hasta liberar espacio o recibir una ampliación. Reducir un límite por debajo del espacio en uso no elimina contenido. El espacio de una nota se carga a su propietario, por lo que quienes colaboran en ella pueden verse limitados si su propietario alcanza el suyo.',
          'Los elementos eliminados pasan a la papelera, donde permanecen de solo lectura hasta que los restaures o los elimines definitivamente. La eliminación definitiva no puede deshacerse desde la Aplicación.',
          'Realizamos copias de seguridad periódicas con fines de continuidad del servicio; los datos eliminados pueden permanecer en ellas por un periodo limitado antes de ser sobrescritos.',
        ],
      },
      {
        heading: '7. Propiedad intelectual',
        paragraphs: [
          'La Aplicación, su diseño, código, marcas y demás elementos son de d4nthi o de sus licenciantes y están protegidos por la normativa de propiedad intelectual. Estos Términos no te transfieren ningún derecho sobre ellos, salvo el derecho limitado de uso del servicio.',
        ],
      },
      {
        heading: '8. Disponibilidad y exclusión de garantías',
        paragraphs: [
          'La Aplicación se ofrece «tal cual» y «según disponibilidad». No garantizamos que funcione de manera ininterrumpida o libre de errores, ni que el contenido no se pierda ante fallos técnicos. Te recomendamos conservar copias de la información importante.',
        ],
      },
      {
        heading: '9. Limitación de responsabilidad',
        paragraphs: [
          'En la medida permitida por la ley, d4nthi no será responsable por daños indirectos, lucro cesante o pérdida de datos derivados del uso o la imposibilidad de uso de la Aplicación. Nada de lo aquí dispuesto excluye responsabilidades que la ley colombiana no permita limitar.',
        ],
      },
      {
        heading: '10. Modificaciones',
        paragraphs: [
          'Podemos actualizar estos Términos. Cuando el cambio sea sustancial, modificaremos la versión vigente y te pediremos aceptarla de nuevo al iniciar sesión. El uso continuado tras la aceptación implica conformidad con la versión vigente.',
        ],
      },
      {
        heading: '11. Ley aplicable y jurisdicción',
        paragraphs: [
          'Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia se someterá a los jueces y tribunales competentes de Colombia, sin perjuicio de los derechos que la ley reconoce a los consumidores.',
        ],
      },
      {
        heading: '12. Contacto',
        paragraphs: [`Para consultas sobre estos Términos escríbenos a ${CONTACT_EMAIL}.`],
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidad y Tratamiento de Datos Personales',
    updated: 'Última actualización: 5 de octubre de 2026',
    intro:
      'En cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas colombianas sobre protección de datos personales, d4nthi informa cómo trata la información de los usuarios de Notes.',
    sections: [
      {
        heading: '1. Responsable del tratamiento',
        paragraphs: [`d4nthi es el responsable del tratamiento de tus datos personales. Contacto: ${CONTACT_EMAIL}.`],
      },
      {
        heading: '2. Datos que tratamos',
        paragraphs: [
          'Datos de tu cuenta de Google que autorizas al iniciar sesión: identificador de Google, correo electrónico, nombre y foto de perfil.',
          'Contenido que generas: notas, carpetas, imágenes, nombres, y la información de permisos con quién las compartes.',
          'Datos de uso y seguridad: idioma preferido, notas recientes y favoritas, fechas de alta, último inicio de sesión y última actividad, si tienes la aplicación abierta en este momento (estado «en línea»), el espacio de almacenamiento usado y tu límite, registros de auditoría de acciones sobre elementos (creación, edición, cambios de permiso, eliminación), y la versión y fecha de aceptación de los Términos.',
          'Estos datos son visibles para los administradores de d4nthi con fines de operación, seguridad y soporte. Los administradores ven metadatos y el espacio usado, no el contenido de tus notas.',
          'No recolectamos datos sensibles de forma intencional. Eres responsable de no incluirlos en tus notas si no es necesario.',
        ],
      },
      {
        heading: '3. Finalidades',
        paragraphs: [
          'Autenticarte y mantener tu sesión; prestar el servicio de notas y colaboración en tiempo real; permitir compartir contenido; garantizar la seguridad e integridad del servicio y prevenir abusos; gestionar los límites de almacenamiento y la suspensión de cuentas; enviarte avisos operativos sobre el servicio; cumplir obligaciones legales; y atender tus solicitudes.',
          'No vendemos tus datos ni los usamos para publicidad de terceros.',
        ],
      },
      {
        heading: '4. Almacenamiento local y cookies',
        paragraphs: [
          'La Aplicación utiliza el almacenamiento local de tu navegador (localStorage) para guardar tus tokens de sesión, tu perfil básico y preferencias de interfaz. No usamos cookies de seguimiento o publicitarias. Puedes borrar estos datos cerrando sesión o desde la configuración de tu navegador.',
        ],
      },
      {
        heading: '5. Encargados y terceros',
        paragraphs: [
          'Utilizamos Google (autenticación mediante OAuth) y Cloudflare (conectividad y protección del tráfico). Estos proveedores pueden tratar datos en otros países, con las salvaguardas que ofrecen sus propias políticas. Solo se comparte lo necesario para prestar el servicio.',
          'El contenido que compartes es visible para las personas o grupos que designes. Podemos divulgar información cuando una autoridad competente lo requiera conforme a la ley.',
          'El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se ajustará a la Política de Datos de Usuario de los Servicios de API de Google, incluidos los requisitos de uso limitado.',
        ],
      },
      {
        heading: '6. Conservación',
        paragraphs: [
          'Conservamos tus datos mientras mantengas tu cuenta activa y durante el tiempo necesario para cumplir obligaciones legales. Tras una eliminación definitiva, el contenido puede persistir temporalmente en copias de seguridad hasta su rotación.',
        ],
      },
      {
        heading: '7. Seguridad',
        paragraphs: [
          'Aplicamos medidas técnicas y organizativas razonables: comunicaciones cifradas (HTTPS), control de acceso por permisos, tokens de sesión de corta duración y acceso a la base de datos restringido. Ningún sistema es completamente infalible; te recomendamos proteger tu cuenta de Google.',
        ],
      },
      {
        heading: '8. Tus derechos como titular',
        paragraphs: [
          'Conforme a la Ley 1581 de 2012 puedes: conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización otorgada; ser informado del uso que se da a tus datos; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización y/o solicitar la supresión de tus datos cuando no se respeten los principios y garantías legales; y acceder gratuitamente a tus datos personales.',
          `Para ejercerlos escribe a ${CONTACT_EMAIL} desde el correo asociado a tu cuenta. Atenderemos tu solicitud dentro de los plazos legales (consultas: 10 días hábiles; reclamos: 15 días hábiles, prorrogables conforme a la ley).`,
        ],
      },
      {
        heading: '9. Menores de edad',
        paragraphs: [
          'La Aplicación no está dirigida a menores de edad sin autorización de sus representantes legales. Si detectamos datos de un menor tratados sin dicha autorización, los suprimiremos.',
        ],
      },
      {
        heading: '10. Cambios en esta política',
        paragraphs: [
          'Podemos actualizar esta política. Si el cambio es relevante, actualizaremos la versión vigente y te pediremos aceptarla nuevamente al iniciar sesión.',
        ],
      },
    ],
  },
};

const en: Record<LegalKind, LegalDocument> = {
  terms: {
    title: 'Terms and Conditions of Use',
    updated: 'Last updated: October 5, 2026',
    intro:
      'These Terms and Conditions govern access to and use of Notes (the “Application”), a real-time collaborative notes and files service provided by d4nthi (“d4nthi”, “we”). By signing in you declare that you have read and accept them.',
    sections: [
      {
        heading: '1. Acceptance and capacity',
        paragraphs: [
          'Using the Application means you fully accept these Terms and the Privacy Policy. If you do not agree, you must not use it.',
          'You declare that you have legal capacity to be bound under Colombian law and, if you are a minor, that you have your legal guardians’ authorization.',
        ],
      },
      {
        heading: '2. The service',
        paragraphs: [
          'Notes lets you create, organize and edit notes and folders, attach images, share them with other people or groups with different permission levels, restore items from the trash and export content.',
          'We may modify, suspend or discontinue features to improve the service or for technical reasons, and will try to give notice when a change is significant.',
        ],
      },
      {
        heading: '3. Account and access',
        paragraphs: [
          'Access is through your Google account. You are responsible for the security of your account and for all activity carried out from it. Notify us immediately if you detect unauthorized use.',
        ],
      },
      {
        heading: '4. User content',
        paragraphs: [
          'You keep ownership of the content you create or upload. You grant us a limited, non-exclusive, royalty-free license solely to store, process and display it to provide the service (including collaboration with the people you choose to share it with).',
          'You are solely responsible for your content and for having the rights needed to publish it. When you share a note, people who receive access can view it and, depending on the permission granted, edit it.',
        ],
      },
      {
        heading: '5. Acceptable use',
        paragraphs: [
          'You agree not to use the Application to: (a) store or distribute illegal or defamatory content, or content that infringes third-party or intellectual property rights; (b) attempt unauthorized access to other people’s data or accounts; (c) interfere with the operation or security of the service, including uploading malicious code; (d) use automated means that degrade the service.',
          'We may suspend or terminate access and remove content in case of breach of these Terms or a request from a competent authority.',
          'Suspension (blocking the account) is decided by a d4nthi administrator: it ends your sessions and prevents you from signing in, but does not delete your notes. If you think it is a mistake, write to our contact e-mail.',
        ],
      },
      {
        heading: '6. Storage, trash and backups',
        paragraphs: [
          'Each account has a storage limit (250 MB by default), which counts the text of your notes and their images, including what is in the trash. You can check your usage in Settings. Administrators can raise or lower an account’s limit.',
          'When you reach the limit you can read and delete content, but not add new content until you free space or receive an increase. Lowering a limit below the space in use does not delete content. The space of a note is charged to its owner, so collaborators can be limited if the owner reaches theirs.',
          'Deleted items go to the trash, where they stay read-only until you restore them or delete them permanently. Permanent deletion cannot be undone from the Application.',
          'We take periodic backups for service continuity; deleted data may remain in them for a limited period before being overwritten.',
        ],
      },
      {
        heading: '7. Intellectual property',
        paragraphs: [
          'The Application, its design, code, trademarks and other elements belong to d4nthi or its licensors and are protected by intellectual property law. These Terms do not transfer any rights to you other than the limited right to use the service.',
        ],
      },
      {
        heading: '8. Availability and disclaimer',
        paragraphs: [
          'The Application is provided “as is” and “as available”. We do not guarantee uninterrupted or error-free operation, or that content will not be lost due to technical failures. Keep copies of important information.',
        ],
      },
      {
        heading: '9. Limitation of liability',
        paragraphs: [
          'To the extent permitted by law, d4nthi is not liable for indirect damages, loss of profit or data loss arising from the use of, or inability to use, the Application. Nothing here excludes liability that Colombian law does not allow to be limited.',
        ],
      },
      {
        heading: '10. Changes',
        paragraphs: [
          'We may update these Terms. For substantial changes we will change the current version and ask you to accept it again when you sign in. Continued use after acceptance means you agree to the current version.',
        ],
      },
      {
        heading: '11. Governing law and jurisdiction',
        paragraphs: [
          'These Terms are governed by the laws of the Republic of Colombia. Any dispute will be submitted to the competent courts of Colombia, without prejudice to the rights the law grants to consumers.',
        ],
      },
      {
        heading: '12. Contact',
        paragraphs: [`For questions about these Terms, write to ${CONTACT_EMAIL}.`],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy and Personal Data Processing',
    updated: 'Last updated: October 5, 2026',
    intro:
      'In compliance with Law 1581 of 2012, Decree 1377 of 2013 (compiled in Decree 1074 of 2015) and other Colombian personal data protection rules, d4nthi explains how it processes the information of Notes users.',
    sections: [
      {
        heading: '1. Data controller',
        paragraphs: [`d4nthi is the controller of your personal data. Contact: ${CONTACT_EMAIL}.`],
      },
      {
        heading: '2. Data we process',
        paragraphs: [
          'Google account data you authorize when signing in: Google identifier, email address, name and profile picture.',
          'Content you generate: notes, folders, images, names, and the permission information of who you share them with.',
          'Usage and security data: preferred language, recent and favorite items, sign-up date, last sign-in and last activity, whether you have the app open right now (“online” status), the storage space used and your limit, audit logs of actions on items (creation, edits, permission changes, deletion), and the version and date of your acceptance of the Terms.',
          'This data is visible to d4nthi administrators for operations, security and support purposes. Administrators see metadata and space used, not the content of your notes.',
          'We do not intentionally collect sensitive data. You are responsible for not including it in your notes unless necessary.',
        ],
      },
      {
        heading: '3. Purposes',
        paragraphs: [
          'To authenticate you and keep your session; to provide the notes and real-time collaboration service; to let you share content; to ensure the security and integrity of the service and prevent abuse; to manage storage limits and account suspension; to send you operational notices about the service; to comply with legal obligations; and to handle your requests.',
          'We do not sell your data or use it for third-party advertising.',
        ],
      },
      {
        heading: '4. Local storage and cookies',
        paragraphs: [
          'The Application uses your browser’s local storage (localStorage) to keep your session tokens, basic profile and interface preferences. We do not use tracking or advertising cookies. You can clear this data by signing out or from your browser settings.',
        ],
      },
      {
        heading: '5. Processors and third parties',
        paragraphs: [
          'We use Google (OAuth authentication) and Cloudflare (connectivity and traffic protection). These providers may process data in other countries under the safeguards of their own policies. Only what is necessary to provide the service is shared.',
          'Content you share is visible to the people or groups you designate. We may disclose information when a competent authority requires it under the law.',
          'The use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
        ],
      },
      {
        heading: '6. Retention',
        paragraphs: [
          'We keep your data while your account is active and for as long as needed to meet legal obligations. After a permanent deletion, content may temporarily persist in backups until they rotate.',
        ],
      },
      {
        heading: '7. Security',
        paragraphs: [
          'We apply reasonable technical and organizational measures: encrypted communications (HTTPS), permission-based access control, short-lived session tokens and restricted database access. No system is completely infallible; we recommend protecting your Google account.',
        ],
      },
      {
        heading: '8. Your rights as data subject',
        paragraphs: [
          'Under Law 1581 of 2012 you may: know, update and rectify your data; request proof of the authorization granted; be informed of how your data is used; file complaints with the Superintendence of Industry and Commerce; revoke the authorization and/or request deletion of your data when legal principles and guarantees are not respected; and access your personal data free of charge.',
          `To exercise them, write to ${CONTACT_EMAIL} from the email linked to your account. We will answer within the legal deadlines (queries: 10 business days; claims: 15 business days, extendable as provided by law).`,
        ],
      },
      {
        heading: '9. Minors',
        paragraphs: [
          'The Application is not aimed at minors without their legal guardians’ authorization. If we detect data of a minor processed without such authorization, we will delete it.',
        ],
      },
      {
        heading: '10. Changes to this policy',
        paragraphs: [
          'We may update this policy. If the change is relevant, we will update the current version and ask you to accept it again when you sign in.',
        ],
      },
    ],
  },
};

export function getLegalDocument(kind: LegalKind, language: Language): LegalDocument {
  return (language === 'en' ? en : es)[kind];
}
