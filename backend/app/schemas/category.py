from pydantic import BaseModel

class CategoryCreate(BaseModel):
    name: str
    type: str
    color: str = "#6B7280"
    icon: str = "tag"

class CategoryOut(BaseModel):
    id: int
    name: str
    type: str
    color: str
    icon: str
    is_default: bool

    class Config:
        from_attributes = True