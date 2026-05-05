export interface User {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

export interface FarmInfo {
  id: number;
  name: string;
  description: string;
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface PlcInfo {
  id: number;
  farm_id: number;
  name: string;
  description: string;
  ip: string;
  port: number;
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface PlcAddInfo {
  id: number;
  plc_id: number;
  name: string;
  address: string;
  data_type: 'Word' | 'Bit';
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface PlcCtrlInfo {
  id: number;
  plc_add_id: number;
  name: string;
  description: string;
  value: string;
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface SequenceGrpInfo {
  id: number;
  name: string;
  description: string;
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface SequenceInfo {
  id: number;
  grp_id: number;
  plc_ctrl_id: number;
  name: string;
  description: string;
  start_gap: number;
  use: 'Y' | 'N';
  created_at: string;
  modified_at: string;
}

export interface ScheduleInfo {
  id: number;
  name: string;
  farm_id: number;
  plc_id: number;
  plc_add_id: number;
  ctrl_id: number;
  exec_datetime: string;
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly';
  use: 'Y' | 'N';
  is_sequence: 'Y' | 'N';
  seq_grp_id: number | null;
  created_at: string;
  modified_at: string;
}

export interface FarmImage {
  id: number;
  farm_id: number;
  filename: string;
  url: string;
  created_at: string;
}
