from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    fullName: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6)
    countryCode: str = Field(min_length=2, max_length=2)
    companyName: str | None = None
    companyAbout: str | None = None
    companyWebsite: str | None = None
    companyIndustry: str | None = None
    companyPhone: str | None = None

    @field_validator('fullName', 'companyName', 'companyAbout', 'companyWebsite', 'companyIndustry', 'companyPhone', mode='before')
    @classmethod
    def _trim_optional(cls, v):
        if v is None:
            return None
        val = str(v).strip()
        return val or None

    @field_validator('email', mode='before')
    @classmethod
    def _email_norm(cls, v):
        return str(v).strip().lower()

    @field_validator('countryCode', mode='before')
    @classmethod
    def _country(cls, v):
        return str(v).strip().upper()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

    @field_validator('email', mode='before')
    @classmethod
    def _email_norm(cls, v):
        return str(v).strip().lower()
