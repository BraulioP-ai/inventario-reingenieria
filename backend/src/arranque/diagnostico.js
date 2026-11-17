// Traduce los errores de conexión/instalación a instrucciones concretas
// según el sistema operativo. Cada error que nos reportaron al probar el
// proyecto en otras máquinas tiene aquí su explicación.

const SO = process.platform; // 'win32' | 'linux' | 'darwin'

const ENCENDER_MYSQL = {
  win32: [
    'MySQL instalado con el instalador oficial: abre PowerShell como administrador y ejecuta',
    '    net start MySQL80',
    'XAMPP: abre el XAMPP Control Panel y presiona "Start" en MySQL.',
  ],
  linux: [
    'Ubuntu / Debian / Mint:        sudo systemctl start mysql      (o mariadb)',
    'Fedora / Arch / openSUSE:      sudo systemctl start mariadb    (o mysqld)',
    'Para que arranque siempre:     sudo systemctl enable --now mysql',
    'Si no lo tienes instalado:     sudo apt install mysql-server   |   sudo dnf install mariadb-server',
    '                               sudo pacman -S mariadb  (y luego: sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql)',
  ],
  darwin: [
    'Homebrew:  brew services start mysql',
  ],
};

const USUARIO_LINUX = [
  'En Linux, MySQL y MariaDB suelen dejar al usuario "root" entrando SOLO con sudo',
  '(autenticación por socket), así que ninguna contraseña le va a funcionar a este programa.',
  'Crea un usuario para el sistema. Copia y pega esto en la terminal:',
  '',
  '    sudo mysql -e "CREATE USER IF NOT EXISTS \'inventario\'@\'localhost\' IDENTIFIED BY \'Inventario123*\'; CREATE USER IF NOT EXISTS \'inventario\'@\'127.0.0.1\' IDENTIFIED BY \'Inventario123*\'; GRANT ALL PRIVILEGES ON *.* TO \'inventario\'@\'localhost\'; GRANT ALL PRIVILEGES ON *.* TO \'inventario\'@\'127.0.0.1\'; FLUSH PRIVILEGES;"',
  '',
  'y en este asistente usa   usuario: inventario   contraseña: Inventario123*',
];

export function explicarError(err, cfg) {
  const destino = cfg.socketPath ? `el socket ${cfg.socketPath}` : `${cfg.host}:${cfg.port}`;
  const lineas = [];

  switch (err.code) {
    case 'ECONNREFUSED':
    case 'ENOENT':
      lineas.push(`MySQL no está encendido (nadie responde en ${destino}).`, '', ...(ENCENDER_MYSQL[SO] ?? []));
      if (cfg.port !== 3306) lineas.push('', `Ojo: el puerto de MySQL normalmente es 3306 y tienes ${cfg.port}.`);
      break;

    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENOTFOUND':
      lineas.push(`No se pudo llegar al servidor ${cfg.host}. Si MySQL está en esta misma computadora usa 127.0.0.1.`);
      break;

    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
      lineas.push(`MySQL rechazó el usuario "${cfg.user}" o su contraseña.`);
      if (SO === 'linux' && cfg.user === 'root') lineas.push('', ...USUARIO_LINUX);
      else if (SO === 'win32') lineas.push('Es la contraseña que pusiste para root al instalar MySQL. En XAMPP, root normalmente no tiene contraseña (déjala vacía).');
      break;

    case 'ER_NOT_SUPPORTED_AUTH_MODE':
    case 'AUTH_SWITCH_PLUGIN_ERROR':
      lineas.push('El usuario usa un método de autenticación que este programa no soporta.');
      if (SO === 'linux') lineas.push('', ...USUARIO_LINUX);
      break;

    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_TABLEACCESS_DENIED_ERROR':
    case 'ER_SPECIFIC_ACCESS_DENIED_ERROR':
    case 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER':
      lineas.push(
        `El usuario "${cfg.user}" entra a MySQL pero no tiene permisos para crear la base de datos y sus triggers.`,
        'Usa root o dale todos los permisos a ese usuario:',
        '',
        SO === 'linux'
          ? `    sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO '${cfg.user}'@'localhost'; FLUSH PRIVILEGES;"`
          : `    GRANT ALL PRIVILEGES ON *.* TO '${cfg.user}'@'localhost'; FLUSH PRIVILEGES;`,
      );
      break;

    case 'ER_PARSE_ERROR':
    case 'ER_UNKNOWN_COLLATION':
    case 'ER_UNKNOWN_CHARACTER_SET':
      lineas.push('La versión de MySQL es demasiado antigua. Se necesita MySQL 8.0.16+ o MariaDB 10.6+.');
      break;

    default:
      lineas.push(`Error de MySQL: ${err.sqlMessage ?? err.message} (${err.code ?? 'sin código'})`);
  }
  return lineas;
}
