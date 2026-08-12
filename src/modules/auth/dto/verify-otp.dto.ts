import {
  IsMobilePhone,
  IsString,
  IsNumberString,
  Length,
  IsEmail,
  ValidateIf,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class VerifyOtpDto {
  @IsMobilePhone()
  mobile!: string;

  @ValidateIf((o) => !o.mobile)
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email?: string;

  @IsNumberString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  ipAddress!: string;

  @IsString()
  deviceId!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsBoolean()
  confirmNewDevice?: boolean;
}

