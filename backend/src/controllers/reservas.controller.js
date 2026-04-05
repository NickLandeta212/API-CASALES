const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const reservaModel = require('../models/reserva.model');

const validStates = ['disponible', 'en_proceso', 'reservado'];

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

module.exports = { list, getById, create, update, remove };
