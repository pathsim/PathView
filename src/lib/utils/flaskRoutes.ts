import process from "process"

export function getFlaskBackendUrl() {
    return process.env.FLASK_ENV == "production" ? process.env.FLASK_SERVER_URL : "http://localhost:8000"
}