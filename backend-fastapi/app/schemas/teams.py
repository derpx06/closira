from pydantic import BaseModel, Field


class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class UpdateRoleRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CreateMemberRequest(BaseModel):
    fullName: str = Field(min_length=1, max_length=255)
    email: str
    password: str = Field(min_length=6)
    companyRoleId: int = Field(gt=0)


class UpdateMemberRequest(BaseModel):
    companyRoleId: int | None = Field(default=None, gt=0)
