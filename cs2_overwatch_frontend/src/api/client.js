import axios from 'axios'

const api = axios.create({
  baseURL: 'https://overwatch.corp14x3.com',
  withCredentials: true,
})

export default api
