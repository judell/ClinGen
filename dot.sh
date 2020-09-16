sudo gunicorn -b 0.0.0.0:8002 -w1 --threads 10 dot:app
