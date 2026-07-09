/**
 * ExtractedResume — the structured JSON contract the AI layer produces.
 *
 * This shape is deliberately a bridge between three consumers, so the same
 * object flows through the whole pipeline without translation surprises:
 *
 *  • DB      — `firstName`, `lastName`, `email`, `phone`, `summary` (→ User.bio),
 *              `headline`, `location`, `skills` map 1:1 onto columns of the
 *              existing `User` model (see prisma/schema.prisma).
 *  • Backend — the same fields line up with `UpdateUserDto`
 *              (src/modules/users/dto/update-user.dto.ts); the Phase 6
 *              ProfileMapper will do the final narrowing to that DTO.
 *  • Frontend — `education` / `experience` intentionally mirror the
 *              `Education` / `Experience` types used by the CV maker
 *              (beleqet-jobs-nextjs/app/cv-maker/page.tsx) so the autofill
 *              form can consume them as-is.
 *
 * The AI is instructed to return exactly this schema. `AIExtractorService`
 * normalises whatever comes back into this shape, so downstream code can rely
 * on every field being present and correctly typed.
 */

/** A single work-experience entry. Mirrors the frontend `Experience` type. */
export interface ExtractedExperience {
  role: string;
  company: string;
  /** Free-form start date as written on the resume, e.g. "Jan 2021". */
  start: string;
  /** Free-form end date, or "Present". */
  end: string;
  description: string;
}

/** A single education entry. Mirrors the frontend `Education` type. */
export interface ExtractedEducation {
  school: string;
  qualification: string;
  /** Free-form year or range, e.g. "2018 – 2022". */
  year: string;
}

/** The full structured resume the AI extracts from raw text. */
export interface ExtractedResume {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Professional summary. Maps to `User.bio`. */
  summary: string;
  /** Professional title / headline. Maps to `User.headline`. */
  headline: string;
  /** City / country. Maps to `User.location`. */
  location: string;
  skills: string[];
  languages: string[];
  certifications: string[];
  education: ExtractedEducation[];
  experience: ExtractedExperience[];
}

/**
 * A fully-formed, empty ExtractedResume. Used as the normalisation baseline so
 * a missing AI field becomes an empty string / array rather than `undefined`.
 */
export const EMPTY_EXTRACTED_RESUME: ExtractedResume = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  summary: '',
  headline: '',
  location: '',
  skills: [],
  languages: [],
  certifications: [],
  education: [],
  experience: [],
};