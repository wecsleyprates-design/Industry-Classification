FROM python:3.10.13
ENV ENTRY_PYTHON_SCRIPT="start.py"
WORKDIR /app
ADD requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
ADD . /app/
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]


#docker build -t aiscore:1 .
#docker run -e ENTRY_PYTHON_SCRIPT='local-start.py' aiscore:1
#docker run -e ENTRY_PYTHON_SCRIPT='start.py' aiscore:1
