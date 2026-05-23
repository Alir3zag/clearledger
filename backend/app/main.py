from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, categories, transactions, budgets, analytics

app = FastAPI(title="ClearLedger API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://clearledger-eta.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(analytics.router)

@app.get("/health")
def health():
    return {"status": "ok"}