import { Gender, Prisma } from '@prisma/client';

export function getPreferredGender(lookingFor: string): Gender | undefined {
  switch (lookingFor.toLowerCase()) {
    case 'bride':
      return Gender.FEMALE;

    case 'groom':
      return Gender.MALE;

    default:
      return undefined;
  }
}

export function getDobFilter(
  lookingFor: string,
  currentDob: Date,
): Prisma.UserProfileWhereInput {
  switch (lookingFor.toLowerCase()) {
    case 'bride':
      // Male searching Bride
      // Bride should be same age or younger
      return {
        dateOfBirth: {
          gte: currentDob,
        },
      };

    case 'groom':
      // Female searching Groom
      // Groom should be same age or older
      return {
        dateOfBirth: {
          lte: currentDob,
        },
      };

    default:
      return {};
  }
}
