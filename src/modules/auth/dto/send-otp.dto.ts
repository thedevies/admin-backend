import { IsEmail, IsMobilePhone, IsString, ValidateIf } from 'class-validator';

export class SendOtpDto {
  @ValidateIf((o) => !o.email)
  @IsMobilePhone(
    'en-IN',
    {},
    { message: 'Please enter a valid mobile number.' },
  )
  mobile?: string;

  @ValidateIf((o) => !o.mobile)
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email?: string;

  @IsString({ message: 'Device ID is required.' })
  deviceId!: string;
}
