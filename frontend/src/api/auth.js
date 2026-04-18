import { apiFetch, fetchFile } from './client.js'

export const authAPI = {
  login: (email, password) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  register: (email, password, name = '') => apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  }),

  getMe: () => apiFetch('/user/me'),

  logout: () => apiFetch('/auth/logout', {
    method: 'POST',
  }),

  updateProfile: (profileData = {}) => {
    const body = {}
    const editableFields = [
      'position',
      'specialization',
      'workgroup',
      'degree',
      'university',
      'experience',
    ]

    if (typeof profileData.name === 'string') {
      const trimmedName = profileData.name.trim()
      if (trimmedName.length > 0) {
        body.name = trimmedName
      }
    }

    if (typeof profileData.profile_image === 'string' && profileData.profile_image) {
      body.profile_image = profileData.profile_image
    }

    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(profileData, field)) {
        body[field] = profileData[field]
      }
    })

    return apiFetch('/user/me/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  changePassword: (currentPassword, newPassword) => apiFetch('/user/me/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  }),

  getProfileImage: () => fetchFile('/user/me/profile-image'),
}
