FROM  golang:1.10

MAINTAINER scnace "scbizu@gmail.com"

ADD . $GOPATH/src/github.com/scbizu/homepage

COPY ./static/ $GOPATH/src/github.com/scbizu/homepage/static/

RUN go get -u github.com/gopherjs/gopherjs && \
cd $GOPATH/src/github.com/scbizu/homepage && \
go install && \
cd static && \
gopherjs build .

ENTRYPOINT homepage -s $GOPATH/src/github.com/scbizu/homepage/static/

EXPOSE 8090
