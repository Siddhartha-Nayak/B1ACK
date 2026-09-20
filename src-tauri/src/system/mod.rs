use serde::Serialize;
use std::sync::Mutex;
use sysinfo::System;
#[derive(Default)]
pub struct Monitor(pub Mutex<System>);
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    cpu: f32,
    used_memory: u64,
    total_memory: u64,
}
impl Monitor {
    pub fn sample(&self) -> Result<Metrics, String> {
        let mut s = self.0.lock().map_err(|_| "System status unavailable")?;
        s.refresh_cpu_usage();
        s.refresh_memory();
        Ok(Metrics {
            cpu: s.global_cpu_usage(),
            used_memory: s.used_memory(),
            total_memory: s.total_memory(),
        })
    }
}
