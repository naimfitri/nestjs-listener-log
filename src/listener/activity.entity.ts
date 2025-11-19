import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  timestamp: Date;

  @Column()
  userId: string;

  @Column()
  url: string;

  @Column()
  processType: string;

  @Column()
  responseTimeMs: number;
}