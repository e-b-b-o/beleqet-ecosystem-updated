import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';

const makeFile = (over: Partial<UploadedResumeFile> = {}): UploadedResumeFile => ({
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('dummy'),
  ...over,
});

describe('ResumeBrainService', () => {
  let service: ResumeBrainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResumeBrainService],
    }).compile();

    service = module.get<ResumeBrainService>(ResumeBrainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('health', () => {
    it('returns an ok status for the Resume Brain module', () => {
      expect(service.health()).toEqual({
        status: 'ok',
        module: 'Resume Brain',
      });
    });
  });

  describe('describeUpload', () => {
    it('returns filename, mimetype and size for a valid PDF', () => {
      const file = makeFile();
      expect(service.describeUpload(file)).toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      });
    });

    it('accepts a .docx file', () => {
      const file = makeFile({
        originalname: 'cv.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(service.describeUpload(file).filename).toBe('cv.docx');
    });

    it('accepts a legacy .doc file', () => {
      const file = makeFile({
        originalname: 'cv.doc',
        mimetype: 'application/msword',
      });
      expect(service.describeUpload(file).filename).toBe('cv.doc');
    });

    it('accepts a file with a valid extension even if the MIME type is generic', () => {
      const file = makeFile({
        originalname: 'resume.pdf',
        mimetype: 'application/octet-stream',
      });
      expect(service.describeUpload(file).filename).toBe('resume.pdf');
    });

    it('throws 400 when no file is provided', () => {
      expect(() => service.describeUpload(undefined)).toThrow(BadRequestException);
    });

    it('throws 415 for an unsupported type (image/png)', () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });
});
