const multer = require('multer');

// Vercel limita el cuerpo de las peticiones a ~4.5 MB.
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const esCsv = file.mimetype === 'text/csv' || /\.csv$/i.test(file.originalname);

    if (!esCsv) {
      const error = new Error('Solo se permiten archivos CSV.');
      error.status = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

module.exports = upload;
