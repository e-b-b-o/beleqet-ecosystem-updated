import { Module } from '@nestjs/common';
import { ResumeBrainService } from './resume-brain.service';
import { ResumeBrainController } from './resume-brain.controller';

@Module({
  providers: [ResumeBrainService],
  controllers: [ResumeBrainController],
})
export class ResumeBrainModule {}
