import apiClient from './apiClient';

function pickMessage(err) {
  const data = err.response?.data;
  if (data && typeof data.message === 'string') return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.message) return data.errors[0].message;
  return err.message || 'Request failed';
}

function toHttpError(err) {
  return Object.assign(new Error(pickMessage(err)), {
    response: err.response,
    code: err.code,
  });
}

async function request(fn) {
  try {
    return await fn();
  } catch (err) {
    throw toHttpError(err);
  }
}

const teamService = {
  listRoles: () =>
    request(async () => {
      const { data } = await apiClient.get('/teams/roles');
      return data.roles;
    }),

  createRole: (payload) =>
    request(async () => {
      const { data } = await apiClient.post('/teams/roles', payload);
      return data.role;
    }),

  updateRole: (id, payload) =>
    request(async () => {
      const { data } = await apiClient.patch(`/teams/roles/${id}`, payload);
      return data.role;
    }),

  deleteRole: (id) =>
    request(async () => {
      await apiClient.delete(`/teams/roles/${id}`);
    }),

  listMembers: () =>
    request(async () => {
      const { data } = await apiClient.get('/teams/members');
      return data.members;
    }),

  createMember: (payload) =>
    request(async () => {
      const { data } = await apiClient.post('/teams/members', payload);
      return data.member;
    }),

  updateMember: (id, payload) =>
    request(async () => {
      await apiClient.patch(`/teams/members/${id}`, payload);
    }),

  deleteMember: (id) =>
    request(async () => {
      await apiClient.delete(`/teams/members/${id}`);
    }),
};

export default teamService;
