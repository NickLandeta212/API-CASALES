const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const reservaModel = require('../models/reserva.model');
const departamentoModel = require('../models/departamento.model');
const torreModel = require('../models/torre.model');

const validStates = ['disponible', 'en_proceso', 'reservado'];

function createPublicReservaToken() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado en el servidor');
  }

  return jwt.sign(
    {
      scope: 'public_reserva_general',
    },
    process.env.JWT_SECRET,
    { noTimestamp: true }
  );
}

function verifyPublicReservaToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado en el servidor');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.scope !== 'public_reserva_general') {
      throw new HttpError(401, 'Token QR invalido');
    }

    return decoded;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, 'Token QR invalido');
  }
}

function validatePublicPayload(body) {
  const { nombres, apellidos, documento, fecha, departamento_id } = body;

  if (!nombres || !apellidos || !documento || !fecha || !departamento_id) {
    throw new HttpError(400, 'nombres, apellidos, documento, departamento_id y fecha son requeridos');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
    throw new HttpError(400, 'fecha debe tener formato YYYY-MM-DD');
  }
}

function isFutureOrToday(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requested = new Date(`${dateString}T00:00:00`);
  return requested >= today;
}

function saveComprobanteImage(dataUrl, departamentoId) {
  if (!dataUrl) {
    return null;
  }

  const match = String(dataUrl).match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);

  if (!match) {
    throw new HttpError(400, 'El comprobante debe ser una imagen PNG, JPG o WEBP valida');
  }

  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const base64Payload = match[2];
  const buffer = Buffer.from(base64Payload, 'base64');
  const maxSizeInBytes = 4 * 1024 * 1024;

  if (buffer.length > maxSizeInBytes) {
    throw new HttpError(400, 'El comprobante supera el maximo de 4MB');
  }

  const uploadsDir = path.resolve(__dirname, '../../uploads/comprobantes');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const fileName = `dep-${departamentoId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const fullPath = path.join(uploadsDir, fileName);

  fs.writeFileSync(fullPath, buffer);

  return `/uploads/comprobantes/${fileName}`;
}

function validatePayload(body) {
  const { departamento_id, fecha, estado } = body;

  if (!departamento_id || !fecha) {
    throw new HttpError(400, 'departamento_id y fecha son requeridos');
  }

  if (estado && !validStates.includes(estado)) {
    throw new HttpError(400, 'estado debe ser disponible, en_proceso o reservado');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
    throw new HttpError(400, 'fecha debe tener formato YYYY-MM-DD');
  }
}

const list = asyncHandler(async (req, res) => {
  const reservas = req.user.role === 'condomino'
    ? await reservaModel.findAllByUsuarioId(req.user.sub)
    : await reservaModel.findAll();
  res.json(reservas);
});

const getById = asyncHandler(async (req, res) => {
  const reserva = req.user.role === 'condomino'
    ? await reservaModel.findByIdForUsuario(Number(req.params.id), req.user.sub)
    : await reservaModel.findById(Number(req.params.id));

  if (!reserva) {
    throw new HttpError(404, 'Reserva no encontrada');
  }

  res.json(reserva);
});

const create = asyncHandler(async (req, res) => {
  validatePayload(req.body);

  if (req.user.role === 'condomino') {
    const isOwner = await reservaModel.isDepartamentoOwnedByUsuario(Number(req.body.departamento_id), req.user.sub);

    if (!isOwner) {
      throw new HttpError(403, 'No puedes reservar para un departamento que no te pertenece');
    }
  }

  try {
    const reserva = await reservaModel.create({
      departamento_id: Number(req.body.departamento_id),
      fecha: req.body.fecha,
      estado: req.body.estado || 'disponible',
      observaciones: req.body.observaciones,
    });

    res.status(201).json(reserva);
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'Ya existe una reserva para esa fecha');
    }

    throw error;
  }
});

const update = asyncHandler(async (req, res) => {
  validatePayload(req.body);

  if (req.user.role === 'condomino') {
    const targetReserva = await reservaModel.findByIdForUsuario(Number(req.params.id), req.user.sub);

    if (!targetReserva) {
      throw new HttpError(404, 'Reserva no encontrada');
    }

    const isOwner = await reservaModel.isDepartamentoOwnedByUsuario(Number(req.body.departamento_id), req.user.sub);

    if (!isOwner) {
      throw new HttpError(403, 'No puedes mover reservas a un departamento que no te pertenece');
    }
  }

  try {
    const reserva = await reservaModel.update(Number(req.params.id), {
      departamento_id: Number(req.body.departamento_id),
      fecha: req.body.fecha,
      estado: req.body.estado || 'disponible',
      observaciones: req.body.observaciones,
    });

    if (!reserva) {
      throw new HttpError(404, 'Reserva no encontrada');
    }

    res.json(reserva);
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'Ya existe una reserva para esa fecha');
    }

    throw error;
  }
});

const remove = asyncHandler(async (req, res) => {
  if (req.user.role === 'condomino') {
    const targetReserva = await reservaModel.findByIdForUsuario(Number(req.params.id), req.user.sub);

    if (!targetReserva) {
      throw new HttpError(404, 'Reserva no encontrada');
    }
  }

  const reserva = await reservaModel.remove(Number(req.params.id));

  if (!reserva) {
    throw new HttpError(404, 'Reserva no encontrada');
  }

  res.json({ message: 'Reserva eliminada correctamente' });
});

const generatePublicToken = asyncHandler(async (req, res) => {
  const token = createPublicReservaToken();

  res.json({ token });
});

const publicContext = asyncHandler(async (req, res) => {
  verifyPublicReservaToken(req.params.token);
  const torres = await torreModel.findAll();
  const departamentos = await departamentoModel.findAll();

  const reservedDates = await reservaModel.findReservedDates();

  res.json({
    torres: torres.map((item) => ({ id: item.id, numero: item.numero })),
    departamentos: departamentos.map((item) => ({ id: item.id, numero: item.numero, torre_id: item.torre_id, torre_numero: item.torre_numero })),
    reserved_dates: reservedDates,
  });
});

const publicCreate = asyncHandler(async (req, res) => {
  verifyPublicReservaToken(req.params.token);
  validatePublicPayload(req.body);

  if (!isFutureOrToday(req.body.fecha)) {
    throw new HttpError(400, 'Solo puedes seleccionar la fecha de hoy o una fecha futura');
  }

  const departamentoId = Number(req.body.departamento_id);
  const departamento = await departamentoModel.findById(departamentoId);

  if (!departamento) {
    throw new HttpError(404, 'Departamento no encontrado');
  }

  const requester = {
    nombres: String(req.body.nombres).trim(),
    apellidos: String(req.body.apellidos).trim(),
    documento: String(req.body.documento).trim(),
    telefono: String(req.body.telefono || '').trim(),
  };

  const noteSections = [
    `[QR] Solicitante: ${requester.nombres} ${requester.apellidos}`,
    `Documento: ${requester.documento}`,
  ];

  const comprobanteUrl = saveComprobanteImage(req.body.comprobante_base64, departamentoId);

  if (requester.telefono) {
    noteSections.push(`Telefono: ${requester.telefono}`);
  }

  if (comprobanteUrl) {
    noteSections.push(`Comprobante: ${comprobanteUrl}`);
  }

  if (req.body.observaciones) {
    noteSections.push(`Observaciones: ${String(req.body.observaciones).trim()}`);
  }

  try {
    const reserva = await reservaModel.create({
      departamento_id: departamentoId,
      fecha: req.body.fecha,
      estado: 'en_proceso',
      observaciones: noteSections.join(' | '),
    });

    res.status(201).json({
      message: 'Solicitud de reserva enviada correctamente',
      reserva,
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'La fecha seleccionada ya no esta disponible');
    }

    throw error;
  }
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  generatePublicToken,
  publicContext,
  publicCreate,
};
