FROM  daocloud.io/library/golang:1.9.0

MAINTAINER scnace "scbizu@gmail.com"

ADD . $GOPATH/src/github.com/scbizu/homepage

RUN go get -u github.com/gopherjs/gopherjs && \
cd $GOPATH/src/github.com/scbizu/homepage && \
go install && \
cd static && \
gopherjs build .

ENTRYPOINT $GOPATH/bin/homepage

EXPOSE 8000
